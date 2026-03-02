import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifyRecallWebhook, downloadBotTranscript } from '@/lib/recall'
import { analyzeOrgMeeting } from '@/lib/analyze-meeting'

/**
 * POST /api/webhooks/recall
 *
 * Receives all Recall.ai webhook events (subscribe to everything in the dashboard).
 * We only act on the ones we care about; everything else is silently acknowledged.
 *
 * Webhook URL: https://app.joinflax.com/api/webhooks/recall
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // Log every incoming webhook attempt so we can see if events are arriving
  const signature = request.headers.get('X-Recall-Signature') ?? ''
  let previewEvent = '(unparseable)'
  try { previewEvent = (JSON.parse(rawBody) as Record<string, unknown>).event as string } catch { /* ignore */ }
  console.log(`[webhook/recall] Received: event="${previewEvent}" sig_present=${!!signature}`)

  if (!verifyRecallWebhook(rawBody, signature)) {
    console.warn('[webhook/recall] Signature check FAILED — check RECALL_WEBHOOK_SECRET matches Recall dashboard')
    // Still return 200 to prevent Recall retrying; bad secret = misconfiguration, not a malicious request
    return NextResponse.json({ ok: true, warning: 'signature_mismatch' })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = payload.event as string
  const data = payload.data as Record<string, unknown> | undefined
  const bot = data?.bot as Record<string, unknown> | undefined
  const botId = (bot?.id ?? data?.bot_id) as string | undefined

  if (!botId) {
    // Some events (calendar, slack, etc.) have no bot — just acknowledge
    return NextResponse.json({ ok: true })
  }

  const db = createServiceClient()

  // ── Bot lifecycle → status updates ───────────────────────────────────────
  const botStatusMap: Record<string, string> = {
    'bot.joining_call':          'in_call',
    'bot.in_waiting_room':       'in_call',
    'bot.in_call_not_recording': 'in_call',
    'bot.in_call_recording':     'in_call',
    'bot.call_ended':            'processing',  // call over, transcript being processed
    'bot.done':                  'done',
    'bot.fatal':                 'failed',
  }

  const newBotStatus = botStatusMap[event]
  if (newBotStatus) {
    // For fatal events, extract the sub_code from the latest status_change
    let botError: string | null = null
    if (event === 'bot.fatal') {
      const statusChanges = bot?.status_changes as Array<Record<string, string>> | undefined
      const latest = statusChanges?.at(-1)
      botError = latest?.sub_code ?? latest?.message ?? 'unknown_error'
      console.warn(`[webhook/recall] Bot ${botId} fatal: ${botError}`)
    }

    const update: Record<string, unknown> = { bot_status: newBotStatus }
    if (botError) update.bot_error = botError

    const { error } = await db
      .from('org_meetings')
      .update(update)
      .eq('recall_bot_id', botId)

    if (error) {
      console.error(`[webhook/recall] Status update failed for bot ${botId}:`, error.message)
    } else {
      console.log(`[webhook/recall] Bot ${botId} → ${event} (status: ${newBotStatus})`)
    }
  }

  // ── transcript.done → download and store ────────────────────────────────
  // This is the correct event for "transcript is ready".
  // bot.done just means the bot finished — transcript may not be ready yet.
  if (event === 'transcript.done') {
    try {
      const segments = await downloadBotTranscript(botId)

      const transcript = {
        segments,
        metadata: {
          word_count: segments.reduce((n, s) => n + s.text.split(' ').length, 0),
          duration_seconds: segments.length
            ? Math.round(segments[segments.length - 1].end_time)
            : 0,
        },
      }

      const { error } = await db
        .from('org_meetings')
        .update({ transcript, bot_status: 'done' })
        .eq('recall_bot_id', botId)

      if (error) {
        console.error(`[webhook/recall] Transcript save failed for bot ${botId}:`, error.message)
      } else {
        console.log(`[webhook/recall] Transcript stored for bot ${botId} (${segments.length} segments)`)

        // Fetch the org_meeting id and trigger Phase 2 AI analysis (fire-and-forget)
        const { data: orgMeeting } = await db
          .from('org_meetings')
          .select('id')
          .eq('recall_bot_id', botId)
          .single()

        if (orgMeeting?.id) {
          analyzeOrgMeeting(orgMeeting.id).catch((err) =>
            console.error(`[webhook/recall] Phase 2 analysis failed for ${orgMeeting.id}:`, err)
          )
        }
      }
    } catch (err) {
      console.error(`[webhook/recall] Transcript download failed for bot ${botId}:`, err)
    }
  }

  // ── transcript.failed → mark as failed ──────────────────────────────────
  if (event === 'transcript.failed') {
    await db
      .from('org_meetings')
      .update({ bot_status: 'failed' })
      .eq('recall_bot_id', botId)
    console.warn(`[webhook/recall] Transcript failed for bot ${botId}`)
  }

  return NextResponse.json({ ok: true })
}
