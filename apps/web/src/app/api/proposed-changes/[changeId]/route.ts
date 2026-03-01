import { NextResponse } from 'next/server'
import { createSupabaseServer, createServiceClient } from '@/lib/supabase-server'
import { updateBlockInContent } from '@/lib/blocknote-utils'

interface Params {
  params: Promise<{ changeId: string }>
}

// PATCH /api/proposed-changes/[changeId]  body: { action: 'accept' | 'reject' }
export async function PATCH(req: Request, { params }: Params) {
  const { changeId } = await params
  const { action } = await req.json()

  if (action !== 'accept' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be accept or reject' }, { status: 400 })
  }

  const authDb = await createSupabaseServer()
  const { data: { user } } = await authDb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use service client for the multi-step accept operation (atomic update across tables)
  const db = createServiceClient()

  // Fetch the change + its meeting title
  const { data: change, error: fetchError } = await db
    .from('proposed_changes')
    .select('*, meetings(title)')
    .eq('id', changeId)
    .single()

  if (fetchError || !change) {
    return NextResponse.json({ error: 'Change not found' }, { status: 404 })
  }

  if (change.status !== 'pending') {
    return NextResponse.json({ error: 'Change already resolved' }, { status: 409 })
  }

  if (action === 'reject') {
    await db.from('proposed_changes').update({ status: 'rejected' }).eq('id', changeId)
    return NextResponse.json({ success: true, action: 'rejected' })
  }

  // Accept: update doc content + write block_history + mark accepted
  const { data: doc, error: docError } = await db
    .from('documents')
    .select('content')
    .eq('id', change.doc_id)
    .single()

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const updatedContent = updateBlockInContent(doc.content, change.block_id, change.after_content)

  // Update doc content
  const { error: updateError } = await db
    .from('documents')
    .update({ content: updatedContent })
    .eq('id', change.doc_id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Write to block history so the amber stripe + history panel show the context
  await db.from('block_history').insert({
    block_id: change.block_id,
    doc_id: change.doc_id,
    before_content: change.before_content,
    after_content: change.after_content,
    source: 'ai',
    author_name: 'AI',
    author_color: '#92400E',
    meeting_id: change.meeting_id,
    meeting_title: (change.meetings as { title: string } | null)?.title ?? null,
    reason: change.reason,
  })

  // Mark as accepted
  await db.from('proposed_changes').update({ status: 'accepted' }).eq('id', changeId)

  return NextResponse.json({ success: true, action: 'accepted' })
}
