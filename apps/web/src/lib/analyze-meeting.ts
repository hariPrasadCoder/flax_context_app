/**
 * Phase 2: AI analysis pipeline for Recall.ai meeting transcripts.
 *
 * Every completed meeting gets:
 *   1. A bullet-point summary + action items (Claude Haiku — fast, cheap)
 *   2. Project match attempt (same Haiku call)
 *   3. Block-level doc proposals if confidence = "high" (Claude Sonnet)
 *
 * The function is idempotent:
 *   - Re-runs summary/match only if not already done
 *   - Re-runs proposals only if project matched but no proposals exist yet
 *   - Safe to call multiple times (e.g. after manual project linking)
 */
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'
import { extractBlocksWithIds } from '@/lib/blocknote-utils'

interface TranscriptSegment {
  speaker: string
  text: string
  start_time: number
  end_time: number
}

function segmentsToPlainText(segments: TranscriptSegment[], maxWords = 2000): string {
  let wordCount = 0
  const lines: string[] = []
  for (const seg of segments) {
    const words = seg.text.split(' ')
    if (wordCount + words.length > maxWords) {
      lines.push(`${seg.speaker}: ${words.slice(0, maxWords - wordCount).join(' ')}…`)
      break
    }
    lines.push(`${seg.speaker}: ${seg.text}`)
    wordCount += words.length
  }
  return lines.join('\n')
}

export async function analyzeOrgMeeting(orgMeetingId: string): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(`[analyze] No ANTHROPIC_API_KEY — skipping analysis for ${orgMeetingId}`)
    return
  }

  const db = createServiceClient()
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // ── Fetch the meeting ──────────────────────────────────────────────────────
  const { data: meeting, error: meetingErr } = await db
    .from('org_meetings')
    .select('id, org_id, meeting_title, transcript, matched_project_id, match_confidence, meeting_summary')
    .eq('id', orgMeetingId)
    .single()

  if (meetingErr || !meeting) {
    console.error(`[analyze] Meeting not found: ${orgMeetingId}`)
    return
  }

  if (!meeting.transcript) {
    console.log(`[analyze] No transcript yet for ${orgMeetingId} — skipping`)
    return
  }

  const transcript = meeting.transcript as { segments: TranscriptSegment[]; metadata: Record<string, unknown> }
  const plainTranscript = segmentsToPlainText(transcript.segments)
  const title = meeting.meeting_title ?? 'Untitled meeting'
  const alreadySummarized = !!meeting.meeting_summary

  // ── Step 1: Summary + action items + project match (Haiku) ────────────────
  // Skip only if already summarized AND project match already resolved
  const matchAlreadyDone = alreadySummarized && meeting.match_confidence !== null
  if (!matchAlreadyDone) {
    const { data: projects } = await db
      .from('projects')
      .select('id, name, description')
      .eq('org_id', meeting.org_id)
      .eq('visibility', 'workspace')

    const projectList = (projects ?? [])
      .map((p, i) => `${i + 1}. "${p.name}" (id: ${p.id})${p.description ? `: ${p.description}` : ''}`)
      .join('\n')

    const haikusPrompt = `You analyze meeting transcripts for a product team.

Meeting title: "${title}"
Transcript:
${plainTranscript}
${(projects ?? []).length ? `\nProjects in this workspace:\n${projectList}` : '\nNo projects in this workspace.'}

Return ONLY valid JSON (no explanation, no markdown):
{
  "summary": "3-5 bullet points covering key topics and decisions. Use • as bullet. Be concise.",
  "action_items": ["Specific action item 1", "Specific action item 2"],
  "project_id": ${(projects ?? []).length ? '"<exact UUID from list, or null>"' : 'null'},
  "confidence": "high|low|none",
  "reasoning": "one sentence"
}

Rules:
- summary: focus on decisions made, not just topics discussed
- action_items: only concrete tasks mentioned; include owner if named; max 6 items
- project_id: the most clearly relevant project UUID, or null
- confidence: high = meeting is clearly about this project, low = possibly related, none = unrelated`

    try {
      const res = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: haikusPrompt }],
      })

      const text = res.content[0].type === 'text' ? res.content[0].text : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])

        // Validate project_id
        const validProjectId =
          parsed.project_id && (projects ?? []).some((p) => p.id === parsed.project_id)
            ? parsed.project_id
            : null

        const confidence: 'high' | 'low' | 'none' = parsed.confidence ?? 'none'

        await db.from('org_meetings').update({
          meeting_summary: parsed.summary ?? null,
          action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
          matched_project_id: validProjectId,
          match_confidence: confidence,
        }).eq('id', orgMeetingId)

        console.log(
          `[analyze] Summary generated for "${title}" — project: ${validProjectId} (${confidence})`
        )
      }
    } catch (err) {
      console.error('[analyze] Haiku call failed:', err)
      // Don't return — still try to generate proposals if project was manually set
    }
  }

  // ── Step 2: Doc proposals (Sonnet) ────────────────────────────────────────
  // Re-fetch to get the latest match state (may have just been updated above)
  const { data: updated } = await db
    .from('org_meetings')
    .select('matched_project_id, match_confidence')
    .eq('id', orgMeetingId)
    .single()

  const matchedProjectId = updated?.matched_project_id as string | null
  const confidence = updated?.match_confidence as string | null

  if (confidence !== 'high' || !matchedProjectId) {
    console.log(`[analyze] Confidence "${confidence}" — skipping proposals for "${title}"`)
    return
  }

  // Check if proposals already exist for this meeting
  const { count: existingProposals } = await db
    .from('proposed_changes')
    .select('id', { count: 'exact', head: true })
    .eq('org_meeting_id', orgMeetingId)

  if (existingProposals && existingProposals > 0) {
    console.log(`[analyze] Proposals already exist for ${orgMeetingId} — skipping`)
    return
  }

  // Fetch docs in matched project
  const { data: docs } = await db
    .from('documents')
    .select('id, title, content')
    .eq('project_id', matchedProjectId)

  const docBlocks = (docs ?? [])
    .map((doc) => ({
      docId: doc.id as string,
      title: doc.title as string,
      blocks: extractBlocksWithIds(doc.content),
    }))
    .filter((d) => d.blocks.length > 0)

  if (!docBlocks.length) {
    console.log(`[analyze] No document content in project ${matchedProjectId}`)
    return
  }

  const docsSection = docBlocks
    .map(
      (d) =>
        `=== Document: "${d.title}" (docId: ${d.docId}) ===\n` +
        d.blocks.map((b) => `[blockId: ${b.blockId}]\n${b.text}`).join('\n\n')
    )
    .join('\n\n')

  const proposalPrompt = `Here are the current project documents:

${docsSection}

Meeting title: "${title}"
Meeting transcript:
${plainTranscript}

Based on what was discussed, identify which documentation blocks should be updated.

Rules:
- Only propose changes when the meeting explicitly discussed something that contradicts or should update the docs
- Be conservative — only propose changes with clear evidence from the transcript
- Keep proposed text concise and consistent with the existing doc style
- Only modify existing blocks (do not create new ones)
- Maximum 10 changes total

Return a JSON array only, no explanation:
[{
  "docId": "<exact docId>",
  "blockId": "<exact blockId>",
  "afterContent": "<new plain text>",
  "reason": "<1-2 sentences from transcript>"
}]

Return [] if no updates are needed.`

  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: proposalPrompt }],
    })

    const text = res.content[0].type === 'text' ? res.content[0].text : ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return

    const proposals: Array<{ docId: string; blockId: string; afterContent: string; reason: string }> =
      JSON.parse(jsonMatch[0])

    if (!proposals.length) {
      console.log(`[analyze] No proposals for "${title}"`)
      return
    }

    const blockMap = new Map<string, string>()
    docBlocks.forEach((d) => d.blocks.forEach((b) => blockMap.set(b.blockId, b.text)))

    const valid = proposals.filter(
      (p) =>
        p.docId && p.blockId && p.afterContent &&
        docBlocks.some((d) => d.docId === p.docId) &&
        blockMap.has(p.blockId)
    )

    if (!valid.length) return

    await Promise.all(
      valid.map((p) =>
        db.from('proposed_changes').insert({
          doc_id: p.docId,
          org_meeting_id: orgMeetingId,
          block_id: p.blockId,
          before_content: blockMap.get(p.blockId) ?? null,
          after_content: p.afterContent,
          reason: p.reason,
          status: 'pending',
        })
      )
    )

    console.log(`[analyze] Created ${valid.length} proposals for "${title}" → project ${matchedProjectId}`)
  } catch (err) {
    console.error('[analyze] Sonnet call failed:', err)
  }
}
