import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// GET /api/proposed-changes?docId=xxx[&status=pending]
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const docId = searchParams.get('docId')
  const status = searchParams.get('status') ?? 'pending'

  if (!docId) return NextResponse.json({ error: 'docId required' }, { status: 400 })

  const db = createServiceClient()

  const { data, error } = await db
    .from('proposed_changes')
    .select('*, meetings(title, created_at)')
    .eq('doc_id', docId)
    .eq('status', status)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
