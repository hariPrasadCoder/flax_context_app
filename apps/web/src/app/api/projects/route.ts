import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const db = createServiceClient()
  const { data: projects, error } = await db
    .from('projects')
    .select('*, documents(id, title, parent_id, updated_at, created_at)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(projects)
}

export async function POST(req: Request) {
  const db = createServiceClient()
  const body = await req.json()
  const { name, description, emoji, color } = body

  const { data, error } = await db
    .from('projects')
    .insert({ name, description, emoji: emoji ?? '📄', color: color ?? '#2563EB' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
