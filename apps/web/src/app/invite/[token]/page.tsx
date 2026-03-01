import { createServiceClient, createSupabaseServer } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { InviteAcceptClient } from './InviteAcceptClient'

interface Params {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Params) {
  const { token } = await params

  // Use service client to look up the invitation (bypasses RLS — invite page is public)
  const service = createServiceClient()
  const { data: invitation } = await service
    .from('invitations')
    .select('id, org_id, email, role, expires_at, accepted_at, organizations(name, slug)')
    .eq('token', token)
    .maybeSingle()

  if (!invitation) {
    return (
      <InviteError message="This invite link is invalid or has already been used." />
    )
  }

  if (invitation.accepted_at) {
    return <InviteError message="This invite link has already been used." />
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return <InviteError message="This invite link has expired. Ask your team admin for a new one." />
  }

  // Check current auth session
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If user is already in this org, redirect home
  if (user) {
    const { data: existing } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('org_id', invitation.org_id)
      .maybeSingle()

    if (existing) redirect('/')
  }

  const org = invitation.organizations as unknown as { name: string; slug: string }

  return (
    <InviteAcceptClient
      token={token}
      orgName={org.name}
      role={invitation.role}
      isLoggedIn={!!user}
      userEmail={user?.email}
      inviteEmail={invitation.email}
    />
  )
}

function InviteError({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <p className="text-2xl mb-3">🔒</p>
        <p className="font-semibold text-[var(--color-text)] mb-2">Invalid invite</p>
        <p className="text-sm text-[var(--color-text-muted)]">{message}</p>
      </div>
    </div>
  )
}
