import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { scanMeetings } from '@/lib/scan-meetings'
import { getBotStatusCode, recallStatusToDbStatus } from '@/lib/recall'

/**
 * POST /api/calendar/sync
 * Authenticated endpoint that:
 *   1. Runs a full calendar scan (discover new meetings, dispatch bots)
 *   2. Polls Recall.ai directly for any active bot statuses
 *      — keeps status accurate even when webhooks are delayed/missing
 */
export async function POST() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()

  // 1. Run calendar scan
  let scanResult = { scanned: 0, dispatched: 0 }
  try {
    scanResult = await scanMeetings()
  } catch (err) {
    console.error('[calendar/sync] scanMeetings failed:', err)
  }

  // 2. Poll Recall.ai for active bots (dispatched / in_call)
  const { data: activeMeetings } = await db
    .from('org_meetings')
    .select('id, recall_bot_id, bot_status')
    .not('recall_bot_id', 'is', null)
    .in('bot_status', ['dispatched', 'in_call', 'processing'])

  if (activeMeetings?.length) {
    await Promise.all(
      activeMeetings.map(async (m) => {
        const code = await getBotStatusCode(m.recall_bot_id as string)
        if (!code) return
        const newStatus = recallStatusToDbStatus(code)
        if (!newStatus || newStatus === m.bot_status) return
        await db
          .from('org_meetings')
          .update({ bot_status: newStatus })
          .eq('id', m.id)
        console.log(`[calendar/sync] Bot ${m.recall_bot_id} status polled: ${m.bot_status} → ${newStatus} (${code})`)
      })
    )
  }

  return NextResponse.json({ ok: true, ...scanResult })
}
