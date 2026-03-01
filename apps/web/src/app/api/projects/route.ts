import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export async function GET() {
  const db = await createSupabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS automatically scopes this to the user's org and accessible projects
  const { data: projects, error } = await db
    .from('projects')
    .select('*, documents(id, title, parent_id, updated_at, created_at)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(projects)
}

export async function POST(req: Request) {
  const db = await createSupabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, description, emoji, color, visibility = 'workspace' } = body

  // Look up the user's org — server injects this so the client doesn't need to know it
  const { data: membership } = await db
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'You are not a member of any workspace' }, { status: 403 })
  }

  const { data, error } = await db
    .from('projects')
    .insert({
      name,
      description: description ?? null,
      emoji: emoji ?? '📄',
      color: color ?? '#2563EB',
      visibility,
      org_id: membership.org_id,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
