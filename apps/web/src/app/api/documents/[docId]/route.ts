import { NextResponse } from 'next/server'
import { createSupabaseServer, createServiceClient } from '@/lib/supabase-server'

interface Params {
  params: Promise<{ docId: string }>
}

export async function GET(req: Request, { params }: Params) {
  const { docId } = await params
  const shareToken = new URL(req.url).searchParams.get('token')

  // Public share token access — no login needed
  if (shareToken) {
    const service = createServiceClient()
    const { data, error } = await service
      .from('documents')
      .select('*')
      .eq('id', docId)
      .eq('public_share_token', shareToken)
      .single()
    if (error) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    return NextResponse.json(data)
  }

  // Authenticated access
  const db = await createSupabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: doc, error } = await service
    .from('documents')
    .select('*, projects(visibility, created_by)')
    .eq('id', docId)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // Extract project info and strip the nested object from the response
  const projectData = doc.projects as unknown as { visibility: string; created_by: string } | null
  const projectVis = projectData?.visibility ?? 'workspace'
  const projectCreatedBy = projectData?.created_by
  const { projects: _projects, ...docFields } = doc

  // ── Project-first access gate ─────────────────────────────────────────────
  // Project visibility is the ceiling — documents can never be more open than their project.
  let user_role: string = 'editor'

  if (projectVis === 'private') {
    // Only the project creator can access any document inside a private project
    if (user.id !== projectCreatedBy) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
  } else if (projectVis === 'restricted') {
    // Access and role come entirely from project_members — document visibility is ignored
    const { data: projectMember } = await service
      .from('project_members')
      .select('role')
      .eq('project_id', docFields.project_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!projectMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    user_role = projectMember.role
  } else {
    // Project is workspace — document controls its own access
    if (docFields.visibility === 'private' && docFields.created_by !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    } else if (docFields.visibility === 'restricted' && docFields.created_by !== user.id) {
      const { data: membership } = await service
        .from('document_members')
        .select('role')
        .eq('doc_id', docId)
        .eq('user_id', user.id)
        .maybeSingle()
      user_role = membership?.role ?? 'viewer'
    }
  }

  return NextResponse.json({ ...docFields, user_role, project_visibility: projectVis })
}

export async function PATCH(req: Request, { params }: Params) {
  const { docId } = await params
  const db = await createSupabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const body = await req.json()

  // Fetch doc + project to enforce access control
  const { data: doc } = await service
    .from('documents')
    .select('visibility, created_by, project_id, projects(visibility, created_by)')
    .eq('id', docId)
    .maybeSingle()

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const projectData = doc.projects as unknown as { visibility: string; created_by: string } | null
  const projectVis = projectData?.visibility ?? 'workspace'
  const projectCreatedBy = projectData?.created_by

  // Block visibility changes on docs when project is not workspace —
  // document visibility is irrelevant when the project gates access itself.
  if (body.visibility !== undefined && projectVis !== 'workspace') {
    return NextResponse.json(
      { error: 'Document visibility is controlled by the project' },
      { status: 403 }
    )
  }

  // Viewer guard for content / title / status edits
  const isContentEdit =
    body.title !== undefined || body.content !== undefined || body.status !== undefined
  if (isContentEdit) {
    if (projectVis === 'private' && user.id !== projectCreatedBy) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    } else if (projectVis === 'restricted') {
      const { data: projectMember } = await service
        .from('project_members')
        .select('role')
        .eq('project_id', doc.project_id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!projectMember || projectMember.role === 'viewer') {
        return NextResponse.json(
          { error: 'You have view-only access to this document' },
          { status: 403 }
        )
      }
    } else if (
      projectVis === 'workspace' &&
      doc.visibility === 'restricted' &&
      doc.created_by !== user.id
    ) {
      const { data: membership } = await service
        .from('document_members')
        .select('role')
        .eq('doc_id', docId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!membership || membership.role === 'viewer') {
        return NextResponse.json(
          { error: 'You have view-only access to this document' },
          { status: 403 }
        )
      }
    }
  }

  const { data, error } = await service
    .from('documents')
    .update({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.content !== undefined && { content: body.content }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.visibility !== undefined && { visibility: body.visibility }),
      ...(body.public_share_token !== undefined && {
        public_share_token: body.public_share_token,
      }),
    })
    .eq('id', docId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // When switching doc to restricted (only allowed when project is workspace),
  // ensure the owner is always in the member list
  if (body.visibility === 'restricted') {
    await service
      .from('document_members')
      .upsert({ doc_id: docId, user_id: user.id, role: 'editor' }, { ignoreDuplicates: true })
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const { docId } = await params
  const db = await createSupabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await db.from('documents').delete().eq('id', docId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
