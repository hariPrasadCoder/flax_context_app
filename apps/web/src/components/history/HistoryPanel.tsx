'use client'

import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Bot, GitBranch, ArrowDown, MousePointer, Trash2 } from 'lucide-react'
import { useEditorStore } from '@/stores/editor-store'
import { BlockHistoryEntry } from '@/hooks/useBlockHistory'
import { Badge } from '@/components/ui/Badge'
import { formatDateTime, getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'

// ── Diff view ──────────────────────────────────────────────────────────────────

function DiffText({ before, after }: { before: string | null; after: string }) {
  // Deletion — block was removed
  if (after === '') {
    return (
      <div className="relative pl-3">
        <div className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full bg-red-400" />
        <p className="text-sm text-[var(--color-text-muted)] line-through leading-relaxed py-1 pr-2 opacity-60">
          {before}
        </p>
        <p className="text-xs text-red-500 mt-1.5 font-medium">Block deleted</p>
      </div>
    )
  }

  // New block (no before)
  if (!before) {
    return (
      <div className="relative pl-3">
        <div className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full bg-green-400" />
        <p className="text-sm text-[var(--color-text)] leading-relaxed py-1.5 pr-2">
          {after}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="relative pl-3">
        <div className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full bg-red-300" />
        <p className="text-sm text-[var(--color-text-muted)] line-through leading-relaxed py-1 pr-2 opacity-75">
          {before}
        </p>
      </div>
      <div className="relative pl-3">
        <div className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full bg-green-400" />
        <p className="text-sm text-[var(--color-text)] leading-relaxed py-1 pr-2">
          {after}
        </p>
      </div>
    </div>
  )
}

// ── Single history entry ───────────────────────────────────────────────────────

function HistoryEntry({ change, isLatest }: { change: BlockHistoryEntry; isLatest: boolean }) {
  const isAI = change.source === 'meeting' || change.source === 'ai'
  const isDeleted = change.after_content === ''

  return (
    <div className={cn(
      'rounded-xl border p-3.5 transition-colors',
      isLatest
        ? 'bg-[var(--color-surface)] border-[var(--color-border-strong)] shadow-sm'
        : 'bg-[var(--color-sidebar)] border-[var(--color-border)]'
    )}>
      {/* Author row */}
      <div className="flex items-center gap-2 mb-3">
        {isAI ? (
          <div className="w-6 h-6 rounded-full bg-[var(--color-changed-subtle)] flex items-center justify-center shrink-0">
            <Bot className="w-3 h-3 text-[var(--color-changed)]" />
          </div>
        ) : (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-semibold shrink-0"
            style={{ backgroundColor: change.author_color ?? '#2563EB' }}
          >
            {getInitials(change.author_name ?? 'U')}
          </div>
        )}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-[var(--color-text)]">
            {isAI ? 'AI' : (change.author_name ?? 'Anonymous')}
          </span>
          <Badge variant={isDeleted ? 'danger' : change.source === 'manual' ? 'ghost' : 'changed'}>
            {isDeleted ? 'Deleted' : change.source === 'manual' ? 'Edited' : change.source === 'meeting' ? 'Meeting' : 'AI'}
          </Badge>
          {isLatest && !isDeleted && <Badge variant="success">Current</Badge>}
        </div>
        <span className="text-[10px] text-[var(--color-text-faint)] shrink-0">
          {formatDateTime(new Date(change.created_at))}
        </span>
      </div>

      {/* Diff */}
      <DiffText before={change.before_content} after={change.after_content} />

      {/* Meeting tag */}
      {change.meeting_title && (
        <div className="mt-2.5 text-xs text-[var(--color-changed)] bg-[var(--color-changed-subtle)] px-2.5 py-1.5 rounded-lg font-medium">
          📅 {change.meeting_title}
        </div>
      )}

      {/* Reason */}
      {change.reason && (
        <p className="mt-2 text-xs text-[var(--color-text-muted)] italic leading-relaxed pl-2.5 border-l-2 border-[var(--color-border-strong)]">
          {change.reason}
        </p>
      )}
    </div>
  )
}

// ── Panel states ───────────────────────────────────────────────────────────────

function HoverPrompt() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
      <div className="w-12 h-12 rounded-full bg-[var(--color-sidebar)] flex items-center justify-center mb-4">
        <MousePointer className="w-5 h-5 text-[var(--color-text-faint)]" />
      </div>
      <p className="text-sm font-medium text-[var(--color-text-muted)] mb-2">
        Hover over a block
      </p>
      <p className="text-xs text-[var(--color-text-faint)] leading-relaxed max-w-[180px]">
        Blocks with an amber stripe have change history. Hover to see what changed.
      </p>
    </div>
  )
}

function NoHistoryState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
      <div className="w-10 h-10 rounded-full bg-[var(--color-sidebar)] flex items-center justify-center mb-3">
        <GitBranch className="w-4 h-4 text-[var(--color-text-faint)]" />
      </div>
      <p className="text-sm font-medium text-[var(--color-text-muted)] mb-1">No history</p>
      <p className="text-xs text-[var(--color-text-faint)] leading-relaxed max-w-[180px]">
        This block hasn't been changed yet
      </p>
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────────

interface HistoryPanelProps {
  historyByBlock: Map<string, BlockHistoryEntry[]>
}

export function HistoryPanel({ historyByBlock }: HistoryPanelProps) {
  const { historyPanelOpen, closeHistoryPanel, activeBlockId, openHistoryPanel } = useEditorStore()

  const entries = activeBlockId ? (historyByBlock.get(activeBlockId) ?? []) : []

  // Show most-recent first
  const sorted = [...entries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  // Deleted blocks: entries where the latest event is a deletion
  const deletedBlocks = useMemo(() => {
    const result: BlockHistoryEntry[] = []
    historyByBlock.forEach((blockEntries) => {
      if (blockEntries.length === 0) return
      // historyByBlock is sorted oldest→newest; last entry is the latest
      const latest = blockEntries[blockEntries.length - 1]
      if (latest.after_content === '') result.push(latest)
    })
    return result.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }, [historyByBlock])

  const hasActiveBlock = !!activeBlockId
  const hasHistory = sorted.length > 0

  return (
    <AnimatePresence>
      {historyPanelOpen && (
        <motion.aside
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="w-[320px] shrink-0 flex flex-col bg-[var(--color-surface)] border-l border-[var(--color-border)] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--color-border)] shrink-0">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[var(--color-text)]">
                {hasActiveBlock && hasHistory ? 'Block history' : 'History'}
              </h3>
              {hasActiveBlock && hasHistory && (
                <p className="text-xs text-[var(--color-text-faint)] mt-0.5 truncate">
                  {sorted.length} change{sorted.length !== 1 ? 's' : ''} on this block
                </p>
              )}
            </div>
            <button
              onClick={closeHistoryPanel}
              className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-sidebar-hover)] transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {/* Main content: active block history, or hover prompt */}
            {!hasActiveBlock ? (
              <HoverPrompt />
            ) : !hasHistory ? (
              <NoHistoryState />
            ) : (
              <div className="px-4 py-4 space-y-2">
                {sorted.map((change, i) => (
                  <div key={change.id}>
                    <HistoryEntry change={change} isLatest={i === 0} />
                    {i < sorted.length - 1 && (
                      <div className="flex justify-center py-1.5">
                        <ArrowDown className="w-3 h-3 text-[var(--color-text-faint)]" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Deleted blocks — always visible so they're reachable without a hover target */}
            {deletedBlocks.length > 0 && (
              <div className={cn('px-4 pb-4', (hasActiveBlock && hasHistory) && 'border-t border-[var(--color-border)] pt-4 mt-1')}>
                <p className="text-[10px] font-semibold text-[var(--color-text-faint)] uppercase tracking-widest mb-2">
                  Deleted blocks
                </p>
                <div className="space-y-1.5">
                  {deletedBlocks.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => openHistoryPanel(entry.block_id)}
                      className="w-full text-left px-3 py-2.5 rounded-lg bg-[var(--color-sidebar)] hover:bg-[var(--color-sidebar-hover)] border border-[var(--color-border)] transition-colors"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Trash2 className="w-3 h-3 text-red-400 shrink-0" />
                        <span className="text-xs text-red-400 font-medium">Deleted</span>
                        <span className="text-[10px] text-[var(--color-text-faint)] ml-auto">
                          {formatDateTime(new Date(entry.created_at))}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] line-through opacity-60 truncate">
                        {entry.before_content}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-4 py-3 border-t border-[var(--color-border)]">
            <p className="text-[11px] text-[var(--color-text-faint)] text-center">
              {hasActiveBlock
                ? `Block · ${activeBlockId.slice(0, 8)}…`
                : 'Hover any block to inspect its history'}
            </p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
