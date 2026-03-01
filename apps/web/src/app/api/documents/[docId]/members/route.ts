import { NextResponse } from 'next/server'
import { createSupabaseServer, createServiceClient } from '@/lib/supabase-server'

interface Params {
  params: Promise<{ docId: string }>
}

// Verify the requesting user belongs to the same org as the document's project.
// Returns { userId, service, orgId } on success, or null on failure.
async function authorizeRequest(docId: string) {
  const db = await createSupabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return null

  const service = createServiceClient()

  // Resolve the org that owns this document's project
  const { data: doc } = await service
    .from('documents')
    .select('project_id, projects(org_id)')
    .eq('id', docId)
    .maybeSingle()

  if (!doc) return null
  const docOrgId = (doc.projects as unknown as { org_id: string } | null)?.org_id
  if (!docOrgId) return null

  // Confirm the requesting user is a member of that org
  const { data: membership } = await service
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('org_id', docOrgId)
    .maybeSingle()

  if (!membership) return null
  return { userId: user.id, service, orgId: docOrgId }
}

// GET /api/documents/[docId]/members
// Returns [{ userId, role, displayName, avatarUrl }]
export async function GET(_req: Request, { params }: Params) {
  const { docId } = await params
  const auth = await authorizeRequest(docId)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { service, orgId } = auth

  // Get document members
  const { data: docMembers, error } = await service
    .from('document_members')
    .select('user_id, role')
    .eq('doc_id', docId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!docMembers || docMembers.length === 0) return NextResponse.json([])

  // Enrich with display names from org_members
  const userIds = docMembers.map((m) => m.user_id)
  const { data: orgMembers } = await service
    .from('organization_members')
    .select('user_id, display_name, avatar_url')
    .eq('org_id', orgId)
    .in('user_id', userIds)

  const orgMemberMap = new Map(
    (orgMembers ?? []).map((m) => [m.user_id, m])
  )

  const result = docMembers.map((m) => {
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

// POST /api/documents/[docId]/members
// Body: { userId, role: 'editor' | 'viewer' }
export async function POST(req: Request, { params }: Params) {
  const { docId } = await params
  const auth = await authorizeRequest(docId)
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
    .from('document_members')
    .upsert({ doc_id: docId, user_id: userId, role })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/documents/[docId]/members?userId=xxx
export async function DELETE(req: Request, { params }: Params) {
  const { docId } = await params
  const auth = await authorizeRequest(docId)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { service } = auth
  const userId = new URL(req.url).searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  const { error } = await service
    .from('document_members')
    .delete()
    .eq('doc_id', docId)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
