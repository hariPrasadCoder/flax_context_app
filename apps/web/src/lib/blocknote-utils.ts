/**
 * Utilities for reading and writing BlockNote JSONB content server-side.
 * BlockNote stores documents as a nested array of Block objects.
 */

interface BlockContent {
  type: string
  text: string
  styles?: object
}

interface Block {
  id: string
  type: string
  props?: Record<string, unknown>
  content?: BlockContent[]
  children?: Block[]
}

/** Extract plain text from a single block's content array */
function blockToText(block: Block): string {
  if (!block.content || !Array.isArray(block.content)) return ''
  return block.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('')
}

/** Extract all blocks with their IDs and text, depth-first */
export function extractBlocksWithIds(
  content: unknown
): Array<{ blockId: string; text: string }> {
  if (!content || !Array.isArray(content)) return []
  const result: Array<{ blockId: string; text: string }> = []

  function walk(blocks: Block[]) {
    for (const block of blocks) {
      const text = blockToText(block)
      if (text.trim()) {
        result.push({ blockId: block.id, text })
      }
      if (block.children?.length) walk(block.children)
    }
  }

  walk(content as Block[])
  return result
}

/** Update a specific block's text in the BlockNote JSONB tree (immutable) */
export function updateBlockInContent(
  content: unknown,
  blockId: string,
  newText: string
): unknown {
  if (!content || !Array.isArray(content)) return content

  function walk(blocks: Block[]): Block[] {
    return blocks.map((block) => {
      if (block.id === blockId) {
        return {
          ...block,
          content: [{ type: 'text', text: newText, styles: {} }],
        }
      }
      if (block.children?.length) {
        return { ...block, children: walk(block.children) }
      }
      return block
    })
  }

  return walk(content as Block[])
}
