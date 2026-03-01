import { NextResponse } from 'next/server'
import { createSupabaseServer, createServiceClient } from '@/lib/supabase-server'

// POST /api/orgs — create a new organization (called from onboarding)
export async function POST(req: Request) {
  const db = await createSupabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, slug, displayName } = await req.json()

  if (!name?.trim() || !slug?.trim() || !displayName?.trim()) {
    return NextResponse.json({ error: 'name, slug, and displayName are required' }, { status: 400 })
  }

  // Use service client for org + member creation to bypass RLS bootstrapping issue:
  // The INSERT policy on organization_members requires the org to exist first,
  // and the org INSERT policy requires auth.uid() — which is fine here.
  // But org_members INSERT policy (owner path) requires organizations.created_by = auth.uid(),
  // so we must insert the org first, then the member.
  const service = createServiceClient()

  // Check slug uniqueness
  const { data: existing } = await service
    .from('organizations')
    .select('id')
    .eq('slug', slug.trim())
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'This workspace URL is already taken. Choose a different one.' },
      { status: 409 }
    )
  }

  // Create org
  const { data: org, error: orgError } = await service
    .from('organizations')
    .insert({
      name: name.trim(),
      slug: slug.trim(),
      created_by: user.id,
    })
    .select()
    .single()

  if (orgError) return NextResponse.json({ error: orgError.message }, { status: 500 })

  // Add creator as owner
  const { error: memberError } = await service.from('organization_members').insert({
    org_id: org.id,
    user_id: user.id,
    role: 'owner',
    display_name: displayName.trim(),
    avatar_url: user.user_metadata?.avatar_url ?? null,
  })

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

  return NextResponse.json(org, { status: 201 })
}
