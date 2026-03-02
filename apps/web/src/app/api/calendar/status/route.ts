import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

/**
 * GET /api/calendar/status
 * Returns whether the current user has a connected calendar,
 * plus a list of recent org_meetings so the UI can show bot activity.
 */
export async function GET() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()

  // Check if this user has a calendar connection
  const { data: conn } = await service
    .from('calendar_connections')
    .select('id, auto_join, created_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!conn) {
    return NextResponse.json({ connected: false })
  }

  // Fetch org member to get org_id
  const { data: member } = await service
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  // Show upcoming + recent meetings (next 7 days + past 3 days)
  const from = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: meetings } = member
    ? await service
        .from('org_meetings')
        .select('id, meeting_title, platform, start_time, bot_status, recall_bot_id')
        .eq('org_id', member.org_id)
        .gte('start_time', from)
        .lte('start_time', to)
        .order('start_time', { ascending: true })
        .limit(20)
    : { data: [] }

  return NextResponse.json({
    connected: true,
    autoJoin: conn.auto_join,
    connectedAt: conn.created_at,
    recentMeetings: meetings ?? [],
  })
}

/**
 * PATCH /api/calendar/status
 * Toggle auto_join on/off.
 */
export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const autoJoin = Boolean(body.autoJoin)

  const service = createServiceClient()
  const { error } = await service
    .from('calendar_connections')
    .update({ auto_join: autoJoin })
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, autoJoin })
}
