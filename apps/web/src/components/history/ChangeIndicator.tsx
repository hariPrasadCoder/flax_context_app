'use client'

import { useEditorStore } from '@/stores/editor-store'
import { getBlockHistory } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'

interface ChangeIndicatorProps {
  blockId: string
  docId: string
}

export function ChangeIndicator({ blockId, docId }: ChangeIndicatorProps) {
  const { openHistoryPanel, activeBlockId } = useEditorStore()
  const history = getBlockHistory(blockId, docId)

  if (history.length === 0) return null

  const latest = history[history.length - 1]
  const isActive = activeBlockId === blockId

  return (
    <button
      onClick={() => openHistoryPanel(blockId)}
      title={`${history.length} change${history.length !== 1 ? 's' : ''} · click to view history`}
      className={cn(
        'group absolute -left-5 top-1/2 -translate-y-1/2',
        'flex items-center justify-center w-4 h-4',
        'transition-all duration-150'
      )}
    >
      <span
        className={cn(
          'block rounded-full transition-all duration-150',
          isActive
            ? 'w-2.5 h-2.5 bg-[var(--color-changed)]'
            : 'w-2 h-2 bg-[var(--color-changed)] opacity-60 group-hover:opacity-100 group-hover:scale-125'
        )}
      />
    </button>
  )
}
