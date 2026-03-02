import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

/**
 * GET /api/org-meetings
 * Returns all org meetings enriched with proposal counts + project names.
 */
export async function GET() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()

  const { data: member } = await db
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!member?.org_id) return NextResponse.json([])

  const { data: meetings, error } = await db
    .from('org_meetings')
    .select(
      'id, meeting_title, platform, start_time, end_time, bot_status, bot_error, recall_bot_id, matched_project_id, match_confidence, meeting_summary, action_items'
    )
    .eq('org_id', member.org_id)
    .order('start_time', { ascending: false })
    .limit(100)

  if (error) {
    // Fallback if new columns don't exist yet (migration not run)
    const { data: fallback } = await db
      .from('org_meetings')
      .select('id, meeting_title, platform, start_time, end_time, bot_status, recall_bot_id, matched_project_id, match_confidence')
      .eq('org_id', member.org_id)
      .order('start_time', { ascending: false })
      .limit(100)

    return NextResponse.json(
      (fallback ?? []).map((m) => ({
        ...m,
        bot_error: null,
        meeting_summary: null,
        action_items: [],
        has_transcript: false,
        pending_proposals: 0,
        matched_project_name: null,
      }))
    )
  }

  const meetingIds = (meetings ?? []).map((m) => m.id as string)
  const projectIds = [...new Set((meetings ?? []).map((m) => m.matched_project_id as string).filter(Boolean))]

  const [proposalCountsRes, projectsRes, transcriptFlagsRes] = await Promise.all([
    meetingIds.length
      ? db.from('proposed_changes').select('org_meeting_id').in('org_meeting_id', meetingIds).eq('status', 'pending')
      : Promise.resolve({ data: [] }),
    projectIds.length
      ? db.from('projects').select('id, name').in('id', projectIds)
      : Promise.resolve({ data: [] }),
    // Check which meetings have a transcript without fetching the full JSONB
    meetingIds.length
      ? db.from('org_meetings').select('id').in('id', meetingIds).not('transcript', 'is', null)
      : Promise.resolve({ data: [] }),
  ])

  const pendingCountByMeeting: Record<string, number> = {}
  ;(proposalCountsRes.data ?? []).forEach((r) => {
    const id = r.org_meeting_id as string
    pendingCountByMeeting[id] = (pendingCountByMeeting[id] ?? 0) + 1
  })

  const projectNameById: Record<string, string> = {}
  ;(projectsRes.data ?? []).forEach((p) => { projectNameById[p.id as string] = p.name as string })

  const hasTranscriptSet = new Set((transcriptFlagsRes.data ?? []).map((r) => r.id as string))

  return NextResponse.json(
    (meetings ?? []).map((m) => ({
      ...m,
      has_transcript: hasTranscriptSet.has(m.id as string),
      pending_proposals: pendingCountByMeeting[m.id as string] ?? 0,
      matched_project_name: m.matched_project_id
        ? (projectNameById[m.matched_project_id as string] ?? null)
        : null,
    }))
  )
}
