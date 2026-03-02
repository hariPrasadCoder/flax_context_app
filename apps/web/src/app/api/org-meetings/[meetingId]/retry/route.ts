import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { createRecallBot } from '@/lib/recall'

interface Params {
  params: Promise<{ meetingId: string }>
}

/**
 * POST /api/org-meetings/[meetingId]/retry
 * Re-dispatches a bot for a failed meeting.
 */
export async function POST(_req: Request, { params }: Params) {
  const { meetingId } = await params
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()

  const { data: member } = await db
    .from('organization_members').select('org_id').eq('user_id', user.id).single()

  const { data: meeting } = await db
    .from('org_meetings')
    .select('id, org_id, meeting_url, meeting_title')
    .eq('id', meetingId)
    .single()

  if (!meeting || meeting.org_id !== member?.org_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Get org name for bot naming
  const { data: org } = await db
    .from('organizations').select('name').eq('id', meeting.org_id).single()

  const botName = `${org?.name ?? 'Flax'} Agent`

  try {
    const bot = await createRecallBot({ meetingUrl: meeting.meeting_url, botName })

    await db.from('org_meetings').update({
      recall_bot_id: bot.id,
      bot_status: 'dispatched',
      bot_error: null,
    }).eq('id', meetingId)

    console.log(`[retry] New bot dispatched for "${meeting.meeting_title}" (bot: ${bot.id})`)
    return NextResponse.json({ ok: true, botId: bot.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[retry] Bot dispatch failed for ${meetingId}:`, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
