import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

/**
 * GET /api/calendar/callback
 * Google redirects here after the user grants calendar access.
 * Exchanges the auth code for tokens and stores them.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  const redirectBase = new URL('/meetings', url.origin)

  if (error || !code) {
    redirectBase.searchParams.set('cal', 'error')
    return NextResponse.redirect(redirectBase)
  }

  // Verify the user is still authenticated
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth', url.origin))
  }

  // Must use the same redirect_uri that was passed to the authorize step
  const redirectUri = `${url.origin}/api/calendar/callback`

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    console.error('[calendar/callback] Token exchange failed:', await tokenRes.text())
    redirectBase.searchParams.set('cal', 'error')
    return NextResponse.redirect(redirectBase)
  }

  const tokens = await tokenRes.json()

  // Look up the user's org
  const service = createServiceClient()
  const { data: member } = await service
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!member?.org_id) {
    redirectBase.searchParams.set('cal', 'error')
    return NextResponse.redirect(redirectBase)
  }

  // Upsert calendar connection
  const { error: upsertErr } = await service.from('calendar_connections').upsert(
    {
      user_id: user.id,
      org_id: member.org_id,
      google_access_token: tokens.access_token,
      google_refresh_token: tokens.refresh_token ?? null,
      token_expiry: tokens.expires_in
        ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString()
        : null,
      auto_join: true,
    },
    { onConflict: 'user_id' }
  )

  if (upsertErr) {
    console.error('[calendar/callback] DB upsert failed:', upsertErr.message)
    redirectBase.searchParams.set('cal', 'error')
    return NextResponse.redirect(redirectBase)
  }

  redirectBase.searchParams.set('cal', 'connected')
  return NextResponse.redirect(redirectBase)
}
