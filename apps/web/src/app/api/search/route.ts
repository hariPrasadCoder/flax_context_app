import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// GET /api/search?q=query[&projectId=xxx]
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const projectId = searchParams.get('projectId')

  if (!q || q.length < 2) return NextResponse.json([])

  const db = createServiceClient()

  let query = db
    .from('documents')
    .select('id, title, project_id, updated_at, projects(id, name, emoji, color)')
    .ilike('title', `%${q}%`)
    .order('updated_at', { ascending: false })
    .limit(12)

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
