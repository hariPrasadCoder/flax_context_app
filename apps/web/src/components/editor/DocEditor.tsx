'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useSettingsStore } from '@/stores/settings-store'
import { Skeleton } from '@/components/ui/Skeleton'
import { useDocument } from '@/hooks/useDocument'
import { EditorHeader } from './EditorHeader'
import { EditorCanvas } from './EditorCanvas'
import { HistoryPanel } from '@/components/history/HistoryPanel'
import { ProposedChangesPanel } from './ProposedChangesPanel'
import { useBlockHistory } from '@/hooks/useBlockHistory'
import { useProposedChanges } from '@/hooks/useProposedChanges'

interface DocEditorProps {
  docId: string
}

export function DocEditor({ docId }: DocEditorProps) {
  const { doc, loading, saving, saveContent, saveTitle, publishDoc } = useDocument(docId)
  const { authorName, authorColor } = useSettingsStore()
  const { history, changedBlockIds, historyByBlock, addEntry, refetch: refetchHistory } = useBlockHistory(docId)
  const { pendingCount, refetch: refetchProposals } = useProposedChanges(docId)

  // Use a ref so handleBlockChange stays stable and never causes
  // BlockNoteEditor to tear down + re-register its editor.onChange listener.
  const docStatusRef = useRef<'draft' | 'published'>(doc?.status ?? 'draft')
  useEffect(() => {
    if (doc?.status) docStatusRef.current = doc.status
  }, [doc?.status])

  const handleContentChange = useCallback(
    (content: unknown) => { saveContent(content) },
    [saveContent]
  )

  const handleBlockChange = useCallback(
    (blockId: string, before: string, after: string) => {
      if (docStatusRef.current === 'draft') return
      addEntry({
        blockId,
        beforeContent: before || null,
        afterContent: after,
        source: 'manual',
        authorName,
        authorColor,
      })
    },
    [addEntry]
  )

  // When user accepts a proposal, reload history and reload the doc to show new content
  const handleProposalAccepted = useCallback(() => {
    refetchHistory()
    refetchProposals()
  }, [refetchHistory, refetchProposals])

  if (loading) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header skeleton */}
        <div className="flex items-center h-13 px-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0 gap-3">
          <Skeleton className="w-7 h-7 shrink-0" />
          <Skeleton className="w-24 h-4" />
          <Skeleton className="w-4 h-4" />
          <Skeleton className="flex-1 h-5 max-w-xs" />
          <Skeleton className="w-16 h-6 ml-auto" />
          <Skeleton className="w-16 h-6" />
        </div>
        {/* Document body skeleton */}
        <div className="flex-1 overflow-y-auto bg-[var(--color-surface)]">
          <div className="max-w-[780px] mx-auto py-10 pb-40 px-16 space-y-3">
            <Skeleton className="h-9 w-2/3 mb-8" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[92%]" />
            <Skeleton className="h-4 w-[85%]" />
            <Skeleton className="h-4 w-[78%]" />
            <div className="pt-4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[88%]" />
            <Skeleton className="h-4 w-[60%]" />
            <div className="pt-4" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[80%]" />
          </div>
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
        pendingCount={pendingCount}
        status={doc.status}
        onPublish={publishDoc}
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
        <ProposedChangesPanel docId={docId} onAccepted={handleProposalAccepted} />
      </div>
    </div>
  )
}
