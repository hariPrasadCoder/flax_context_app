'use client'

import { useCallback } from 'react'
import { useDocument } from '@/hooks/useDocument'
import { EditorHeader } from './EditorHeader'
import { EditorCanvas } from './EditorCanvas'
import { HistoryPanel } from '@/components/history/HistoryPanel'
import { useBlockHistory } from '@/hooks/useBlockHistory'

interface DocEditorProps {
  docId: string
}

export function DocEditor({ docId }: DocEditorProps) {
  const { doc, loading, saving, saveContent, saveTitle } = useDocument(docId)
  // Single source of truth for block history — shared with EditorCanvas and HistoryPanel
  const { history, changedBlockIds, historyByBlock, addEntry } = useBlockHistory(docId)

  const handleContentChange = useCallback(
    (content: unknown) => { saveContent(content) },
    [saveContent]
  )

  const handleBlockChange = useCallback(
    (blockId: string, before: string, after: string) => {
      addEntry({
        blockId,
        beforeContent: before || null,
        afterContent: after,
        source: 'manual',
        authorName: 'You',
        authorColor: '#2563EB',
      })
    },
    [addEntry]
  )

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
          <p className="text-sm text-[var(--color-text-faint)]">Loading document…</p>
        </div>
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-[var(--color-text-muted)]">Document not found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <EditorHeader
        docId={docId}
        title={doc.title}
        projectId={doc.project_id}
        saving={saving}
        onTitleChange={saveTitle}
        historyCount={history.length}
      />
      <div className="flex flex-1 overflow-hidden">
        <EditorCanvas
          docId={docId}
          initialContent={doc.content}
          onContentChange={handleContentChange}
          onBlockChange={handleBlockChange}
          changedBlockIds={changedBlockIds}
        />
        <HistoryPanel historyByBlock={historyByBlock} />
      </div>
    </div>
  )
}
