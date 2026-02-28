'use client'

import { useEffect, useCallback, useRef } from 'react'
import { PartialBlock, Block } from '@blocknote/core'
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import { useEditorStore } from '@/stores/editor-store'
import { useSettingsStore } from '@/stores/settings-store'

interface BlockNoteEditorProps {
  docId: string
  initialContent: unknown
  onContentChange: (content: unknown) => void
  onBlockChange?: (blockId: string, before: string, after: string) => void
  changedBlockIds: Set<string>
}

/** Extract plain text from a BlockNote block */
function blockToText(block: Block): string {
  if (!block.content || !Array.isArray(block.content)) return ''
  return block.content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { type: 'text'; text: string; styles: object }).text)
    .join('')
}

/** Build a snapshot map of blockId → text */
function buildSnapshot(blocks: Block[]): Map<string, string> {
  const map = new Map<string, string>()
  const walk = (list: Block[]) => {
    for (const b of list) {
      map.set(b.id, blockToText(b))
      if (b.children?.length) walk(b.children)
    }
  }
  walk(blocks)
  return map
}

export function BlockNoteEditor({
  docId,
  initialContent,
  onContentChange,
  onBlockChange,
  changedBlockIds,
}: BlockNoteEditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const snapshotRef = useRef<Map<string, string>>(new Map())
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevHoveredRef = useRef<string | null>(null)
  const { openHistoryPanel } = useEditorStore()
  const isDark = useSettingsStore((s) => s.theme === 'dark')

  const editor = useCreateBlockNote({
    ...(initialContent ? { initialContent: initialContent as PartialBlock[] } : {}),
  })

  // Initialise snapshot once editor is ready
  useEffect(() => {
    if (!editor) return
    snapshotRef.current = buildSnapshot(editor.document)
  }, [editor])

  // Save content + detect changed blocks (debounced)
  useEffect(() => {
    if (!editor) return
    const unsubscribe = editor.onChange(() => {
      onContentChange(editor.document)

      if (!onBlockChange) return
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        const current = buildSnapshot(editor.document)

        // Detect new blocks (never seen before) and edits (text changed)
        current.forEach((text, blockId) => {
          const prev = snapshotRef.current.get(blockId)
          if (prev === undefined && text.trim()) {
            // Brand-new block with content — record creation
            onBlockChange(blockId, '', text)
          } else if (prev !== undefined && prev !== text && text.trim()) {
            // Existing block whose text changed — record edit
            onBlockChange(blockId, prev, text)
          }
        })

        // Detect deleted blocks (existed before, gone now)
        snapshotRef.current.forEach((prevText, blockId) => {
          if (!current.has(blockId) && prevText.trim()) {
            onBlockChange(blockId, prevText, '')
          }
        })

        snapshotRef.current = current
      }, 1500)
    })
    return () => {
      unsubscribe?.()
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [editor, onContentChange, onBlockChange])

  // Amber left-border stripe on blocks with history.
  // Applied to .bn-block-content with padding-left so there's breathing room
  // between the stripe and the text (like a diff/blockquote indicator).
  const changedBlockCSS = Array.from(changedBlockIds)
    .map(
      (id) => `
      .flax-blocknote [data-id="${id}"] > .bn-block {
        position: relative;
      }
      .flax-blocknote [data-id="${id}"] > .bn-block::before {
        content: '';
        position: absolute;
        left: -20px;
        top: 2px;
        bottom: 2px;
        width: 3px;
        background-color: var(--color-changed);
        border-radius: 2px;
        transition: opacity 0.15s;
      }
      .flax-blocknote [data-id="${id}"]:hover > .bn-block {
        background-color: color-mix(in srgb, var(--color-changed) 6%, transparent);
      }
    `
    )
    .join('\n')

  // Hover detection — open history panel when hovering a changed block
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const el = (e.target as Element).closest('[data-id]')
      const blockId = el?.getAttribute('data-id') ?? null

      if (blockId === prevHoveredRef.current) return
      prevHoveredRef.current = blockId

      if (blockId && changedBlockIds.has(blockId)) {
        openHistoryPanel(blockId)
      }
    },
    [changedBlockIds, openHistoryPanel]
  )

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    wrapper.addEventListener('mousemove', handleMouseMove)
    return () => wrapper.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  const getSlashMenuItems = useCallback(
    async (query: string) => {
      const items = getDefaultReactSlashMenuItems(editor)
      if (!query) return items
      return items.filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase())
      )
    },
    [editor]
  )

  return (
    <div ref={wrapperRef} className="flax-blocknote relative" data-doc-id={docId}>
      {/* Dynamic amber-dot CSS for changed blocks */}
      {changedBlockIds.size > 0 && (
        <style dangerouslySetInnerHTML={{ __html: changedBlockCSS }} />
      )}

      <BlockNoteView editor={editor} theme={isDark ? 'dark' : 'light'} slashMenu={false}>
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={getSlashMenuItems}
        />
      </BlockNoteView>
    </div>
  )
}
