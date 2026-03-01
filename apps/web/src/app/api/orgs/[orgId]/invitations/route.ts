import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

interface Params {
  params: Promise<{ orgId: string }>
}

// GET /api/orgs/[orgId]/invitations — list active invitations (admins only)
export async function GET(_req: Request, { params }: Params) {
  const { orgId } = await params
  const db = await createSupabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await db
    .from('invitations')
    .select('id, email, token, role, expires_at, accepted_at, created_at')
    .eq('org_id', orgId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/orgs/[orgId]/invitations — create an invite link or email invite
export async function POST(req: Request, { params }: Params) {
  const { orgId } = await params
  const db = await createSupabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { email, role = 'member' } = body

  const { data, error } = await db
    .from('invitations')
    .insert({
      org_id: orgId,
      email: email ?? null,  // null = open invite link
      role,
      invited_by: user.id,
    })
    .select('id, token, email, role, expires_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/orgs/[orgId]/invitations?inviteId=xxx — revoke an invite
export async function DELETE(req: Request, { params }: Params) {
  const { orgId } = await params
  const db = await createSupabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const inviteId = new URL(req.url).searchParams.get('inviteId')
  if (!inviteId) return NextResponse.json({ error: 'inviteId is required' }, { status: 400 })

  const { error } = await db
    .from('invitations')
    .delete()
    .eq('id', inviteId)
    .eq('org_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
