import { NextResponse } from 'next/server'
import { createSupabaseServer, createServiceClient } from '@/lib/supabase-server'

interface Params {
  params: Promise<{ projectId: string }>
}

export async function PATCH(req: Request, { params }: Params) {
  const { projectId } = await params
  const db = await createSupabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const body = await req.json()

  const { data, error } = await service
    .from('projects')
    .update({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.emoji !== undefined && { emoji: body.emoji }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.visibility !== undefined && { visibility: body.visibility }),
    })
    .eq('id', projectId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // When switching to restricted, ensure the owner is always in the member list
  if (body.visibility === 'restricted') {
    await service
      .from('project_members')
      .upsert({ project_id: projectId, user_id: user.id, role: 'editor' }, { ignoreDuplicates: true })
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const { projectId } = await params
  const db = await createSupabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS enforces that only the creator or org admin can delete.
  // CASCADE on foreign keys handles documents, block_history, etc.
  const { error } = await db.from('projects').delete().eq('id', projectId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
