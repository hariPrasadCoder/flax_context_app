/**
 * Core meeting scanner logic.
 * Called by the node-cron scheduler (instrumentation.ts) every 5 minutes.
 * Also callable via POST /api/cron/scan-meetings for manual triggering.
 *
 * Flow:
 *   1. Fetch all users with connected Google Calendars (auto_join = true)
 *   2. For each user: refresh token if needed, fetch upcoming events
 *   3. Upsert events into org_meetings (ON CONFLICT DO NOTHING = dedup)
 *   4. Dispatch Recall bots for meetings starting soon that don't have one yet
 */
import { createServiceClient } from '@/lib/supabase'
import {
  getValidAccessToken,
  fetchUpcomingEvents,
  extractMeetingInfo,
  type CalendarConnection,
} from '@/lib/calendar'
import { createRecallBot } from '@/lib/recall'

export async function scanMeetings(): Promise<{ scanned: number; dispatched: number }> {
  const db = createServiceClient()
  let scanned = 0
  let dispatched = 0

  // ── Step 1: Get all active calendar connections ───────────────────────────
  const { data: connections, error: connErr } = await db
    .from('calendar_connections')
    .select('*')
    .eq('auto_join', true)

  if (connErr) {
    console.error('[scan] Failed to fetch calendar connections:', connErr.message)
    return { scanned: 0, dispatched: 0 }
  }

  if (!connections?.length) {
    console.log('[scan] No calendar connections found')
    return { scanned: 0, dispatched: 0 }
  }

  // ── Step 2: Sync calendar events for each user ────────────────────────────
  for (const conn of connections as CalendarConnection[]) {
    try {
      // Refresh token if expiring soon
      const tokenResult = await getValidAccessToken(conn)

      // Persist refreshed token back to DB
      if (tokenResult.refreshed) {
        await db
          .from('calendar_connections')
          .update({
            google_access_token: tokenResult.newAccessToken,
            token_expiry: tokenResult.newExpiry,
          })
          .eq('user_id', conn.user_id)
      }

      // Discover meetings up to 24 hours ahead so they appear in the UI.
      // Bot dispatch only fires for meetings starting within 20 min (step 3 below).
      const events = await fetchUpcomingEvents(tokenResult.token, 24)
      scanned += events.length

      for (const event of events) {
        const info = extractMeetingInfo(event)
        if (!info) continue

        // Upsert into org_meetings — ON CONFLICT DO NOTHING is the dedup mechanism
        const { error: upsertErr } = await db.from('org_meetings').upsert(
          {
            org_id: conn.org_id,
            discovered_by_user_id: conn.user_id,
            meeting_url: info.url,
            meeting_title: info.title,
            start_time: info.startTime,
            end_time: info.endTime,
            platform: info.platform,
            bot_status: 'pending',
          },
          { onConflict: 'org_id,meeting_url,start_time', ignoreDuplicates: true }
        )
        if (upsertErr) {
          console.error(`[scan] org_meetings upsert failed:`, upsertErr.message)
        }
      }
    } catch (err) {
      console.error(`[scan] Calendar sync failed for user ${conn.user_id}:`, err)
    }
  }

  // ── Step 3: Dispatch bots for meetings that start soon ────────────────────
  // Window: meetings that started up to 30 min ago through 20 min from now.
  // The wide lookback recovers meetings the cron missed (e.g. server restart,
  // meeting added to calendar just before it started, etc.)
  const windowStart = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const windowEnd = new Date(Date.now() + 20 * 60 * 1000).toISOString()

  const { data: pendingMeetings, error: pendingErr } = await db
    .from('org_meetings')
    .select('id, org_id, meeting_url, meeting_title, platform')
    .is('recall_bot_id', null)
    .eq('bot_status', 'pending')
    .gte('start_time', windowStart)
    .lte('start_time', windowEnd)

  if (pendingErr) {
    console.error('[scan] Failed to fetch pending meetings:', pendingErr.message)
    return { scanned, dispatched }
  }

  // Get org names for bot naming
  const orgIds = [...new Set((pendingMeetings ?? []).map((m) => m.org_id as string))]
  const { data: orgs } = await db
    .from('organizations')
    .select('id, name')
    .in('id', orgIds)

  const orgNameById = Object.fromEntries((orgs ?? []).map((o) => [o.id, o.name as string]))

  for (const meeting of pendingMeetings ?? []) {
    try {
      const orgName = orgNameById[meeting.org_id] ?? 'Flax'
      const botName = `${orgName} Agent`

      const bot = await createRecallBot({
        meetingUrl: meeting.meeting_url,
        botName,
      })

      await db
        .from('org_meetings')
        .update({ recall_bot_id: bot.id, bot_status: 'dispatched' })
        .eq('id', meeting.id)

      dispatched++
      console.log(`[scan] Bot dispatched for meeting "${meeting.meeting_title}" → ${meeting.meeting_url} (bot: ${bot.id})`)
    } catch (err) {
      console.error(`[scan] Bot dispatch failed for meeting ${meeting.id}:`, err)
      await db
        .from('org_meetings')
        .update({ bot_status: 'failed' })
        .eq('id', meeting.id)
    }
  }

  console.log(`[scan] Done — events scanned: ${scanned}, bots dispatched: ${dispatched}`)
  return { scanned, dispatched }
}
