/**
 * Google Calendar API helpers.
 * Uses raw fetch — no googleapis SDK needed.
 */

export interface CalendarConnection {
  id: string
  user_id: string
  org_id: string
  google_access_token: string
  google_refresh_token: string | null
  token_expiry: string | null
  auto_join: boolean
}

export interface MeetingInfo {
  url: string
  platform: 'google_meet' | 'zoom'
  title: string
  startTime: string   // ISO
  endTime: string     // ISO
  calendarEventId: string
}

interface GoogleEvent {
  id: string
  summary?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string
      uri: string
    }>
  }
  description?: string
  location?: string
}

// ── Token refresh ─────────────────────────────────────────────────────────────

export async function getValidAccessToken(
  connection: CalendarConnection
): Promise<{ token: string; refreshed: false } | { token: string; refreshed: true; newExpiry: string; newAccessToken: string }> {
  const expiry = connection.token_expiry ? new Date(connection.token_expiry) : null
  const bufferMs = 5 * 60 * 1000 // refresh if expiring within 5 min
  const needsRefresh = !expiry || expiry.getTime() - Date.now() < bufferMs

  if (!needsRefresh) {
    return { token: connection.google_access_token, refreshed: false }
  }

  if (!connection.google_refresh_token) {
    throw new Error(`No refresh token for user ${connection.user_id} — they must reconnect calendar`)
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: connection.google_refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Token refresh failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  const newExpiry = new Date(Date.now() + (data.expires_in as number) * 1000).toISOString()

  return {
    token: data.access_token as string,
    refreshed: true,
    newExpiry,
    newAccessToken: data.access_token as string,
  }
}

// ── Calendar event fetch ──────────────────────────────────────────────────────

/** Fetch events starting within the next `hoursAhead` hours. */
export async function fetchUpcomingEvents(
  accessToken: string,
  hoursAhead = 2
): Promise<GoogleEvent[]> {
  const timeMin = new Date().toISOString()
  const timeMax = new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString()

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  })

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Calendar API error (${res.status}): ${body}`)
  }

  const data = await res.json()
  return (data.items ?? []) as GoogleEvent[]
}

// ── Meeting URL extraction ────────────────────────────────────────────────────

export function extractMeetingInfo(event: GoogleEvent): MeetingInfo | null {
  const startTime = event.start?.dateTime ?? event.start?.date
  const endTime = event.end?.dateTime ?? event.end?.date
  if (!startTime || !endTime) return null

  // 1. Structured conference data (most reliable)
  if (event.conferenceData?.entryPoints) {
    for (const ep of event.conferenceData.entryPoints) {
      if (ep.entryPointType === 'video' && ep.uri) {
        if (ep.uri.includes('meet.google.com')) {
          return { url: ep.uri, platform: 'google_meet', title: event.summary ?? 'Untitled meeting', startTime, endTime, calendarEventId: event.id }
        }
        if (ep.uri.includes('zoom.us')) {
          return { url: cleanZoomUrl(ep.uri), platform: 'zoom', title: event.summary ?? 'Untitled meeting', startTime, endTime, calendarEventId: event.id }
        }
      }
    }
  }

  // 2. Regex fallback in description + location
  const text = `${event.description ?? ''} ${event.location ?? ''}`

  const meetMatch = text.match(/https?:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/)
  if (meetMatch) {
    return { url: meetMatch[0], platform: 'google_meet', title: event.summary ?? 'Untitled meeting', startTime, endTime, calendarEventId: event.id }
  }

  const zoomMatch = text.match(/https?:\/\/[\w.-]+\.zoom\.us\/j\/\d+[^\s"<]*/i)
  if (zoomMatch) {
    return { url: cleanZoomUrl(zoomMatch[0]), platform: 'zoom', title: event.summary ?? 'Untitled meeting', startTime, endTime, calendarEventId: event.id }
  }

  return null
}

/** Strip Zoom join URLs down to the canonical join link (no tracking params). */
function cleanZoomUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}`
  } catch {
    return url
  }
}
