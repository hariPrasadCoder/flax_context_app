// ── Server-only Supabase client ───────────────────────────────────────────────
// This file uses next/headers and must ONLY be imported in:
//   - API route handlers (app/api/**/route.ts)
//   - Server Components (async function Page() {...})
//   - Server Actions
// Never import this in 'use client' files or files imported by client components.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Re-export service client so server files only need one import
export { createServiceClient } from './supabase'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function createSupabaseServer() {
  const cookieStore = await cookies()

  const cookieAdapter = {
    getAll() {
      return cookieStore.getAll()
    },
    setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
        )
      } catch {
        // Server Components cannot set cookies — the middleware handles refresh.
      }
    },
  }

  // Step 1: read the session access token from cookies.
  // In Supabase JS 2.x the PostgREST client falls back to the anon key when no
  // accessToken is provided, so auth.uid() is always null inside RLS policies.
  // We fix this by explicitly injecting the JWT into the global Authorization header.
  const tempClient = createServerClient(url, anonKey, { cookies: cookieAdapter })
  const { data: { session } } = await tempClient.auth.getSession()

  // Step 2: create the real client with the JWT in global headers so every
  // PostgREST request includes it and auth.uid() works in RLS policies.
  return createServerClient(url, anonKey, {
    cookies: cookieAdapter,
    global: session?.access_token
      ? { headers: { Authorization: `Bearer ${session.access_token}` } }
      : {},
  })
}
