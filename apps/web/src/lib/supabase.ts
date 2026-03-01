import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ── Browser client (React components / client-side hooks) ─────────────────────
// Safe to call multiple times — createBrowserClient is a singleton internally.
// This file is safe to import in client components.
export function createSupabaseBrowser() {
  return createBrowserClient(url, anonKey)
}

// ── Service client (admin / bypass RLS) ───────────────────────────────────────
// Use sparingly: invite acceptance, org bootstrapping on first login.
// Server-side only — never import this in client components.
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return createClient(url, serviceKey ?? anonKey)
}

// ── Server client ─────────────────────────────────────────────────────────────
// Import from '@/lib/supabase-server' instead — it uses next/headers which
// cannot be bundled into client components.

