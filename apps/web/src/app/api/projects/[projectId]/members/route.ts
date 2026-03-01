import { NextResponse } from 'next/server'
import { createSupabaseServer, createServiceClient } from '@/lib/supabase-server'

interface Params {
  params: Promise<{ projectId: string }>
}

// Verify requesting user belongs to the same org as the project.
async function authorizeRequest(projectId: string) {
  const db = await createSupabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return null

  const service = createServiceClient()

  const { data: project } = await service
    .from('projects')
    .select('org_id')
    .eq('id', projectId)
    .maybeSingle()

  if (!project) return null

  const { data: membership } = await service
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('org_id', project.org_id)
    .maybeSingle()

  if (!membership) return null
  return { userId: user.id, service, orgId: project.org_id }
}

// GET /api/projects/[projectId]/members
// Returns [{ userId, role, displayName, avatarUrl }]
export async function GET(_req: Request, { params }: Params) {
  const { projectId } = await params
  const auth = await authorizeRequest(projectId)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { service, orgId } = auth

  const { data: projectMembers, error } = await service
    .from('project_members')
    .select('user_id, role')
    .eq('project_id', projectId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!projectMembers || projectMembers.length === 0) return NextResponse.json([])

  const userIds = projectMembers.map((m) => m.user_id)
  const { data: orgMembers } = await service
    .from('organization_members')
    .select('user_id, display_name, avatar_url')
    .eq('org_id', orgId)
    .in('user_id', userIds)

  const orgMemberMap = new Map((orgMembers ?? []).map((m) => [m.user_id, m]))

  const result = projectMembers.map((m) => {
    const orgM = orgMemberMap.get(m.user_id)
    return {
      userId: m.user_id,
      role: m.role,
      displayName: orgM?.display_name ?? null,
      avatarUrl: orgM?.avatar_url ?? null,
    }
  })

  return NextResponse.json(result)
}

// POST /api/projects/[projectId]/members
// Body: { userId, role: 'editor' | 'viewer' }
export async function POST(req: Request, { params }: Params) {
  const { projectId } = await params
  const auth = await authorizeRequest(projectId)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { service } = auth
  const { userId, role } = await req.json()

  if (!userId || !role) {
    return NextResponse.json({ error: 'userId and role are required' }, { status: 400 })
  }
  if (!['editor', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'role must be editor or viewer' }, { status: 400 })
  }

  const { data, error } = await service
    .from('project_members')
    .upsert({ project_id: projectId, user_id: userId, role })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/projects/[projectId]/members?userId=xxx
export async function DELETE(req: Request, { params }: Params) {
  const { projectId } = await params
  const auth = await authorizeRequest(projectId)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { service } = auth
  const userId = new URL(req.url).searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  const { error } = await service
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
