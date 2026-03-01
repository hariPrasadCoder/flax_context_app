'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'

// Disable SSR to prevent ProseMirror/BlockNote hydration mismatches
const BlockNoteEditor = dynamic(
  () => import('./BlockNoteEditor').then((m) => m.BlockNoteEditor),
  { ssr: false }
)

interface EditorCanvasProps {
  docId: string
  title: string
  initialContent: unknown
  onContentChange: (content: unknown) => void
  onBlockChange: (blockId: string, before: string, after: string) => void
  onTitleChange: (title: string) => Promise<void>
  changedBlockIds: Set<string>
  readOnly?: boolean
}

export function EditorCanvas({
  docId,
  title,
  initialContent,
  onContentChange,
  onBlockChange,
  onTitleChange,
  changedBlockIds,
  readOnly = false,
}: EditorCanvasProps) {
  const [localTitle, setLocalTitle] = useState(title)
  const [wordCount, setWordCount] = useState(0)

  // Keep local title in sync when doc loads
  useEffect(() => { setLocalTitle(title) }, [title])

  const handleTitleBlur = useCallback(() => {
    if (localTitle.trim() !== title) {
      onTitleChange(localTitle.trim() || 'Untitled')
    }
  }, [localTitle, title, onTitleChange])

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }, [])

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--color-surface)] flex flex-col">
      <div className="max-w-[780px] w-full mx-auto py-12 pb-40 px-16 flex-1">
        {/* Document title */}
        <textarea
          value={localTitle}
          onChange={readOnly ? undefined : (e) => {
            setLocalTitle(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = e.target.scrollHeight + 'px'
          }}
          onBlur={readOnly ? undefined : handleTitleBlur}
          onKeyDown={readOnly ? undefined : handleTitleKeyDown}
          readOnly={readOnly}
          placeholder="Untitled"
          rows={1}
          className="w-full resize-none overflow-hidden bg-transparent border-none outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] mb-8"
          style={{
            fontFamily: 'var(--font-merriweather), Merriweather, Georgia, serif',
            fontSize: '2.25rem',
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
            cursor: readOnly ? 'default' : undefined,
          }}
        />

        <BlockNoteEditor
          docId={docId}
          initialContent={initialContent}
          onContentChange={onContentChange}
          onBlockChange={onBlockChange}
          onWordCountChange={setWordCount}
          changedBlockIds={changedBlockIds}
          editable={!readOnly}
        />
      </div>

      {/* Word count footer */}
      <div className="shrink-0 flex justify-end px-16 pb-4 max-w-[780px] mx-auto w-full">
        <span className="text-[11px] text-[var(--color-text-faint)] tabular-nums select-none">
          {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
        </span>
      </div>
    </div>
  )
}
