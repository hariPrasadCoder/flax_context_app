import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ')

/**
 * GET /api/calendar/connect
 * Redirects the user to Google's OAuth consent screen.
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Derive redirect URI from the actual request origin so it always matches
  // what's registered in Google Cloud Console, regardless of port or env config.
  const origin = new URL(request.url).origin
  const redirectUri = `${origin}/api/calendar/callback`

  console.log('[calendar/connect] redirect_uri:', redirectUri)

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',   // always request refresh_token
    state: user.id,
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  )
}
