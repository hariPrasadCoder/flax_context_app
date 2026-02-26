import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

interface Params {
  params: Promise<{ docId: string }>
}

export async function GET(_req: Request, { params }: Params) {
  const { docId } = await params
  const db = createServiceClient()

  const { data, error } = await db
    .from('block_history')
    .select('*')
    .eq('doc_id', docId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request, { params }: Params) {
  const { docId } = await params
  const db = createServiceClient()
  const body = await req.json()

  const { data, error } = await db
    .from('block_history')
    .insert({
      block_id: body.blockId,
      doc_id: docId,
      before_content: body.beforeContent ?? null,
      after_content: body.afterContent,
      source: body.source ?? 'manual',
      author_name: body.authorName ?? 'Anonymous',
      author_color: body.authorColor ?? '#2563EB',
      meeting_id: body.meetingId ?? null,
      meeting_title: body.meetingTitle ?? null,
      reason: body.reason ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
