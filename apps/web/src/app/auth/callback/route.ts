import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const inviteToken = searchParams.get('invite')

  // Resolve public-facing origin from proxy headers (Coolify/Traefik sets these).
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host
  const origin = `${proto}://${host}`

  if (!code) {
    return NextResponse.redirect(`${origin}/auth?error=no_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/auth?error=exchange_failed`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/auth?error=no_user`)
  }

  // Check if user has an org membership
  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    // New user — needs to create or join a workspace
    if (inviteToken) {
      // Has an invite — go to the invite page to complete joining
      return NextResponse.redirect(`${origin}/invite/${inviteToken}`)
    }
    return NextResponse.redirect(`${origin}/onboarding`)
  }

  // Existing user with org — go to intended destination or home
  if (inviteToken) {
    // Already has an org but received an invite — try to accept it
    return NextResponse.redirect(`${origin}/invite/${inviteToken}`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
