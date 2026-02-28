import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

interface Params {
  params: Promise<{ docId: string }>
}

export async function GET(_req: Request, { params }: Params) {
  const { docId } = await params
  const db = createServiceClient()

  const { data, error } = await db
    .from('documents')
    .select('*')
    .eq('id', docId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: Params) {
  const { docId } = await params
  const db = createServiceClient()
  const body = await req.json()

  const { data, error } = await db
    .from('documents')
    .update({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.content !== undefined && { content: body.content }),
      ...(body.status !== undefined && { status: body.status }),
    })
    .eq('id', docId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const { docId } = await params
  const db = createServiceClient()

  const { error } = await db.from('documents').delete().eq('id', docId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
