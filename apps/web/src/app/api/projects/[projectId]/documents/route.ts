import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

interface Params {
  params: Promise<{ projectId: string }>
}

export async function POST(req: Request, { params }: Params) {
  const { projectId } = await params
  const db = createServiceClient()
  const body = await req.json()

  const { data, error } = await db
    .from('documents')
    .insert({
      project_id: projectId,
      title: body.title ?? 'Untitled',
      parent_id: body.parentId ?? null,
      content: null,
      status: body.status ?? 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
