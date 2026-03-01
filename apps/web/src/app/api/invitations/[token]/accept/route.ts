import { NextResponse } from 'next/server'
import { createSupabaseServer, createServiceClient } from '@/lib/supabase-server'

interface Params {
  params: Promise<{ token: string }>
}

// POST /api/invitations/[token]/accept — accept an invitation
// Uses service client internally to bypass RLS for the atomicity of the operation.
export async function POST(_req: Request, { params }: Params) {
  const { token } = await params

  // Get the authenticated user
  const db = await createSupabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Look up the invitation
  const { data: invitation } = await service
    .from('invitations')
    .select('id, org_id, email, role, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle()

  if (!invitation) {
    return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 })
  }

  if (invitation.accepted_at) {
    return NextResponse.json({ error: 'This invite has already been used' }, { status: 409 })
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invite has expired' }, { status: 410 })
  }

  // If email-specific invite, verify the user's email matches
  if (invitation.email && invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
    return NextResponse.json(
      { error: `This invite was sent to ${invitation.email}` },
      { status: 403 }
    )
  }

  // Check if user is already in this org
  const { data: existing } = await service
    .from('organization_members')
    .select('org_id')
    .eq('org_id', invitation.org_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    // Already a member — just mark invite accepted and redirect
    await service
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)
    return NextResponse.json({ success: true, alreadyMember: true })
  }

  // Add user to org
  const { error: memberError } = await service.from('organization_members').insert({
    org_id: invitation.org_id,
    user_id: user.id,
    role: invitation.role,
    display_name: user.user_metadata?.full_name ?? null,
    avatar_url: user.user_metadata?.avatar_url ?? null,
  })

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  // Mark invite as accepted
  await service
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  return NextResponse.json({ success: true })
}
