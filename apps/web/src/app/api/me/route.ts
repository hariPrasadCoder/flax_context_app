import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

// GET /api/me — returns the current user + their org membership
export async function GET() {
  const db = await createSupabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await db
    .from('organization_members')
    .select('role, display_name, avatar_url, organizations(id, name, slug, logo_url)')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    id: user.id,
    email: user.email,
    org: membership?.organizations ?? null,
    role: membership?.role ?? null,
    displayName: membership?.display_name ?? user.user_metadata?.full_name ?? null,
    avatarUrl: membership?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
  })
}
