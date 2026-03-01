import { NextResponse } from 'next/server'
import { createSupabaseServer, createServiceClient } from '@/lib/supabase-server'

interface Params {
  params: Promise<{ projectId: string }>
}

export async function POST(req: Request, { params }: Params) {
  const { projectId } = await params
  const db = await createSupabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Verify user can access this project (is a member of the project's org)
  const { data: membership } = await service
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: project } = await service
    .from('projects')
    .select('org_id')
    .eq('id', projectId)
    .maybeSingle()

  if (!membership || !project || membership.org_id !== project.org_id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const body = await req.json()

  const { data, error } = await service
    .from('documents')
    .insert({
      project_id: projectId,
      title: body.title ?? 'Untitled',
      parent_id: body.parentId ?? null,
      content: null,
      status: body.status ?? 'draft',
      visibility: body.visibility ?? 'workspace',
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
