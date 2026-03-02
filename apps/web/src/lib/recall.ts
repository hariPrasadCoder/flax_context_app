/**
 * Recall.ai API helpers.
 */
import crypto from 'crypto'

export interface TranscriptSegment {
  speaker: string
  text: string
  start_time: number
  end_time: number
}

// ── Bot creation ──────────────────────────────────────────────────────────────

export async function createRecallBot(params: {
  meetingUrl: string
  botName: string
}): Promise<{ id: string }> {
  const res = await fetch(`${process.env.RECALL_API_URL}/bot/`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${process.env.RECALL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      meeting_url: params.meetingUrl,
      bot_name: params.botName,
      // Use Recall's default transcription — avoids meeting_captions which
      // requires Google sign-in and native caption permissions.
      recording_config: {
        transcript: {},
      },
      automatic_leave: {
        waiting_room_timeout: 600,   // 10 min in waiting room (up from 5)
        noone_joined_timeout: 600,   // leave if no one joins within 10 min
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Recall bot creation failed (${res.status}): ${body}`)
  }

  return res.json()
}

// ── Direct bot status polling ─────────────────────────────────────────────────

/**
 * Fetch the current status of a bot directly from Recall.ai.
 * Used to sync status without relying on webhooks.
 */
export async function getBotStatusCode(botId: string): Promise<string | null> {
  try {
    const res = await fetch(`${process.env.RECALL_API_URL}/bot/${botId}/`, {
      headers: { Authorization: `Token ${process.env.RECALL_API_KEY}` },
    })
    if (!res.ok) return null
    const bot = await res.json()
    // Recall returns status as an array of status objects ordered chronologically;
    // the last one is the current state. e.g. { code: "in_call_recording", ... }
    const statusList = bot?.status_changes ?? []
    const latestCode: string = statusList.length
      ? (statusList[statusList.length - 1].code as string)
      : (bot?.status?.code as string ?? '')
    return latestCode || null
  } catch {
    return null
  }
}

// Map Recall status codes → our DB bot_status values
export function recallStatusToDbStatus(code: string): string | null {
  const map: Record<string, string> = {
    ready:                  'dispatched',
    joining_call:           'in_call',
    in_waiting_room:        'in_call',
    in_call_not_recording:  'in_call',
    in_call_recording:      'in_call',
    call_ended:             'processing',
    done:                   'done',
    fatal:                  'failed',
  }
  return map[code] ?? null
}

// ── Webhook signature verification ───────────────────────────────────────────

/**
 * Verifies the X-Recall-Signature header using HMAC-SHA256.
 * Recall sends: base64( HMAC-SHA256(secret, rawBody) )
 */
export function verifyRecallWebhook(rawBody: string, signature: string): boolean {
  if (!process.env.RECALL_WEBHOOK_SECRET) return false
  try {
    const expected = crypto
      .createHmac('sha256', process.env.RECALL_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('base64')
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

// ── Transcript download ───────────────────────────────────────────────────────

/** Fetch the completed transcript for a bot from Recall.ai. */
export async function downloadBotTranscript(botId: string): Promise<TranscriptSegment[]> {
  const res = await fetch(`${process.env.RECALL_API_URL}/bot/${botId}/`, {
    headers: { Authorization: `Token ${process.env.RECALL_API_KEY}` },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch bot ${botId}: ${res.status}`)
  }

  const bot = await res.json()

  // Get signed download URL from bot details
  const downloadUrl: string | undefined =
    bot?.recordings?.[0]?.media_shortcuts?.transcript?.data?.download_url

  if (!downloadUrl) {
    console.warn(`[recall] No transcript download URL for bot ${botId}`)
    return []
  }

  const transcriptRes = await fetch(downloadUrl)
  if (!transcriptRes.ok) {
    throw new Error(`Failed to download transcript for bot ${botId}: ${transcriptRes.status}`)
  }

  const raw = await transcriptRes.json()
  return normaliseTranscript(raw)
}

// ── Format normalisation ──────────────────────────────────────────────────────

/**
 * Recall.ai transcript format changed over time.
 * This handles both the old and new structures.
 */
function normaliseTranscript(raw: unknown): TranscriptSegment[] {
  if (!raw || typeof raw !== 'object') return []

  // New format: array of segments with { participant: { name }, words: [...] }
  if (Array.isArray(raw)) {
    const segments: TranscriptSegment[] = []
    for (const seg of raw as Array<Record<string, unknown>>) {
      const speaker = (seg.participant as Record<string, string> | undefined)?.name ?? 'Unknown'
      const words = (seg.words as Array<Record<string, unknown>> | undefined) ?? []
      if (!words.length) continue

      const text = words.map((w) => w.text as string).join(' ').trim()
      const startTime = Number((words[0].start_timestamp as Record<string, number> | undefined)?.relative ?? 0)
      const endTime = Number((words[words.length - 1].end_timestamp as Record<string, number> | undefined)?.relative ?? 0)

      if (text) segments.push({ speaker, text, start_time: startTime, end_time: endTime })
    }
    return segments
  }

  // Old format: { words: [{ speaker, text, start_time, end_time }] }
  const words = (raw as Record<string, unknown>).words
  if (Array.isArray(words)) {
    return words.map((w: Record<string, unknown>) => ({
      speaker: (w.speaker as string) ?? 'Unknown',
      text: (w.text as string) ?? '',
      start_time: Number(w.start_time ?? 0),
      end_time: Number(w.end_time ?? 0),
    }))
  }

  return []
}
