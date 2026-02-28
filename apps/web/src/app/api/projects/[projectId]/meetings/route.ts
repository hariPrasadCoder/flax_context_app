import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'
import { extractBlocksWithIds } from '@/lib/blocknote-utils'

interface Params {
  params: Promise<{ projectId: string }>
}

export async function GET(_req: Request, { params }: Params) {
  const { projectId } = await params
  const db = createServiceClient()

  const { data, error } = await db
    .from('meetings')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request, { params }: Params) {
  const { projectId } = await params
  const db = createServiceClient()
  const { title, transcript } = await req.json()

  if (!title?.trim() || !transcript?.trim()) {
    return NextResponse.json({ error: 'title and transcript are required' }, { status: 400 })
  }

  // 1. Save the meeting
  const { data: meeting, error: meetingError } = await db
    .from('meetings')
    .insert({ project_id: projectId, title: title.trim(), transcript: transcript.trim() })
    .select()
    .single()

  if (meetingError) return NextResponse.json({ error: meetingError.message }, { status: 500 })

  // 2. Check for Anthropic key
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { meeting, proposals: [], warning: 'ANTHROPIC_API_KEY not set — skipping AI analysis' },
      { status: 201 }
    )
  }

  // 3. Fetch all docs in the project that have content
  const { data: docs } = await db
    .from('documents')
    .select('id, title, content')
    .eq('project_id', projectId)

  const docBlocks = (docs ?? [])
    .map((doc) => ({
      docId: doc.id,
      title: doc.title,
      blocks: extractBlocksWithIds(doc.content),
    }))
    .filter((d) => d.blocks.length > 0)

  if (!docBlocks.length) {
    return NextResponse.json({ meeting, proposals: [], warning: 'No document content to analyze' }, { status: 201 })
  }

  // 4. Build prompt
  const docsSection = docBlocks
    .map(
      (d) =>
        `=== Document: "${d.title}" (docId: ${d.docId}) ===\n` +
        d.blocks.map((b) => `[blockId: ${b.blockId}]\n${b.text}`).join('\n\n')
    )
    .join('\n\n')

  const userPrompt = `Here are the current project documents:

${docsSection}

Meeting transcript:
${transcript}

Based on what was discussed in this meeting, identify which documentation blocks should be updated.

Rules:
- Only propose changes when the meeting explicitly discussed something that contradicts or should update the docs
- Be conservative — only propose changes with clear evidence from the transcript
- Keep the proposed text concise and consistent with the existing doc style
- Only modify existing blocks (do not create new ones)
- Maximum 10 changes total

Return a JSON array only, no explanation. Each element:
{
  "docId": "<exact docId from above>",
  "blockId": "<exact blockId from above>",
  "afterContent": "<new plain text for this block>",
  "reason": "<1-2 sentences citing what from the transcript requires this change>"
}

If no updates are needed, return [].`

  let proposals: Array<{
    docId: string
    blockId: string
    afterContent: string
    reason: string
  }> = []

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    // Extract JSON from response (Claude may wrap it in markdown code fences)
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      proposals = JSON.parse(jsonMatch[0])
    }
  } catch (err) {
    console.error('Claude API error:', err)
    return NextResponse.json(
      { meeting, proposals: [], warning: 'AI analysis failed — meeting saved, no proposals generated' },
      { status: 201 }
    )
  }

  // 5. Save proposals to DB, enriching with before_content from current doc state
  const blockMap = new Map<string, string>()
  docBlocks.forEach((d) => d.blocks.forEach((b) => blockMap.set(b.blockId, b.text)))

  const validProposals = proposals.filter(
    (p) =>
      p.docId &&
      p.blockId &&
      p.afterContent &&
      docBlocks.some((d) => d.docId === p.docId) &&
      blockMap.has(p.blockId)
  )

  const insertedProposals = await Promise.all(
    validProposals.map((p) =>
      db
        .from('proposed_changes')
        .insert({
          doc_id: p.docId,
          meeting_id: meeting.id,
          block_id: p.blockId,
          before_content: blockMap.get(p.blockId) ?? null,
          after_content: p.afterContent,
          reason: p.reason,
          status: 'pending',
        })
        .select()
        .single()
        .then(({ data }) => data)
    )
  )

  return NextResponse.json(
    { meeting, proposals: insertedProposals.filter(Boolean) },
    { status: 201 }
  )
}
