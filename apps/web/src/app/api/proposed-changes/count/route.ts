import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

/**
 * GET /api/proposed-changes/count
 * Returns the total count of pending proposals across all docs in the user's org.
 * Used for the sidebar badge on the Meetings nav item.
 */
export async function GET() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ count: 0 }, { status: 401 })
  }

  const db = createServiceClient()

  const { data: member } = await db
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!member?.org_id) {
    return NextResponse.json({ count: 0 })
  }

  // Step 1: Get all project IDs for the org
  const { data: projects } = await db
    .from('projects')
    .select('id')
    .eq('org_id', member.org_id)

  const projectIds = (projects ?? []).map((p) => p.id as string)
  if (!projectIds.length) return NextResponse.json({ count: 0 })

  // Step 2: Get all document IDs in those projects
  const { data: docs } = await db
    .from('documents')
    .select('id')
    .in('project_id', projectIds)

  const docIds = (docs ?? []).map((d) => d.id as string)
  if (!docIds.length) return NextResponse.json({ count: 0 })

  // Step 3: Count pending proposals for those docs
  const { count, error } = await db
    .from('proposed_changes')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .in('doc_id', docIds)

  if (error) {
    console.error('[proposed-changes/count]', error.message)
    return NextResponse.json({ count: 0 })
  }

  return NextResponse.json({ count: count ?? 0 })
}
