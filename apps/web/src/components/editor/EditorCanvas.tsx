'use client'

import dynamic from 'next/dynamic'

// Disable SSR to prevent ProseMirror/BlockNote hydration mismatches
const BlockNoteEditor = dynamic(
  () => import('./BlockNoteEditor').then((m) => m.BlockNoteEditor),
  { ssr: false }
)

interface EditorCanvasProps {
  docId: string
  initialContent: unknown
  onContentChange: (content: unknown) => void
  onBlockChange: (blockId: string, before: string, after: string) => void
  changedBlockIds: Set<string>
}

export function EditorCanvas({
  docId,
  initialContent,
  onContentChange,
  onBlockChange,
  changedBlockIds,
}: EditorCanvasProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[780px] mx-auto py-10 pb-40 px-16">
        <BlockNoteEditor
          docId={docId}
          initialContent={initialContent}
          onContentChange={onContentChange}
          onBlockChange={onBlockChange}
          changedBlockIds={changedBlockIds}
        />
      </div>
    </div>
  )
}
