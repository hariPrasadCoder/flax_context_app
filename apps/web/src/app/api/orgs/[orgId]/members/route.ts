import { NextResponse } from 'next/server'
import { createSupabaseServer, createServiceClient } from '@/lib/supabase-server'

interface Params {
  params: Promise<{ orgId: string }>
}

// GET /api/orgs/[orgId]/members — list all members of an org
export async function GET(_req: Request, { params }: Params) {
  const { orgId } = await params
  const db = await createSupabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use service client to avoid PostgREST JWT issues.
  // Do NOT join auth.users — that table is not accessible via PostgREST.
  const service = createServiceClient()
  const { data, error } = await service
    .from('organization_members')
    .select('user_id, role, display_name, avatar_url, joined_at')
    .eq('org_id', orgId)
    .order('joined_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH /api/orgs/[orgId]/members — update a member's role
export async function PATCH(req: Request, { params }: Params) {
  const { orgId } = await params
  const db = await createSupabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId, role } = await req.json()
  if (!userId || !role) {
    return NextResponse.json({ error: 'userId and role are required' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('organization_members')
    .update({ role })
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/orgs/[orgId]/members?userId=xxx — remove a member
export async function DELETE(req: Request, { params }: Params) {
  const { orgId } = await params
  const db = await createSupabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = new URL(req.url).searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  const service = createServiceClient()
  const { error } = await service
    .from('organization_members')
    .delete()
    .eq('org_id', orgId)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
