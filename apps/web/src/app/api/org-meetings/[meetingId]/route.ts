import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { analyzeOrgMeeting } from '@/lib/analyze-meeting'

interface Params {
  params: Promise<{ meetingId: string }>
}

/**
 * GET /api/org-meetings/[meetingId]
 * Returns full meeting detail including transcript + proposals.
 * Called when user expands a meeting row.
 */
export async function GET(_req: Request, { params }: Params) {
  const { meetingId } = await params
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()

  const { data: member } = await db
    .from('organization_members').select('org_id').eq('user_id', user.id).single()

  const { data: meeting } = await db
    .from('org_meetings')
    .select('*')
    .eq('id', meetingId)
    .single()

  if (!meeting || meeting.org_id !== member?.org_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch proposals with doc titles
  const { data: proposals } = await db
    .from('proposed_changes')
    .select('id, doc_id, block_id, before_content, after_content, reason, status, documents(title)')
    .eq('org_meeting_id', meetingId)
    .order('created_at', { ascending: true })

  // Fetch matched project name
  let matchedProjectName: string | null = null
  if (meeting.matched_project_id) {
    const { data: proj } = await db
      .from('projects').select('name').eq('id', meeting.matched_project_id).single()
    matchedProjectName = proj?.name ?? null
  }

  return NextResponse.json({
    ...meeting,
    matched_project_name: matchedProjectName,
    proposals: (proposals ?? []).map((p) => ({
      ...p,
      doc_title: (p.documents as unknown as { title: string } | null)?.title ?? 'Untitled',
    })),
  })
}

/**
 * PATCH /api/org-meetings/[meetingId]
 * Manually link a meeting to a project, then trigger AI analysis.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { meetingId } = await params
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { project_id } = body

  if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const db = createServiceClient()

  const { data: member } = await db
    .from('organization_members').select('org_id').eq('user_id', user.id).single()

  const { data: meeting } = await db
    .from('org_meetings').select('id, org_id, transcript').eq('id', meetingId).single()

  if (!meeting || meeting.org_id !== member?.org_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await db
    .from('org_meetings')
    .update({ matched_project_id: project_id, match_confidence: 'high' })
    .eq('id', meetingId)

  if (meeting.transcript) {
    analyzeOrgMeeting(meetingId).catch((err) =>
      console.error(`[org-meetings] Manual analysis failed for ${meetingId}:`, err)
    )
  }

  return NextResponse.json({ ok: true })
}
