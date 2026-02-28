import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

interface Params {
  params: Promise<{ projectId: string }>
}

export async function DELETE(_req: Request, { params }: Params) {
  const { projectId } = await params
  const db = createServiceClient()

  // Delete documents first (FK constraint), then the project
  await db.from('documents').delete().eq('project_id', projectId)

  const { error } = await db.from('projects').delete().eq('id', projectId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
