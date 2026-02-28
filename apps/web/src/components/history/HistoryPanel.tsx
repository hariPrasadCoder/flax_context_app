'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { X, Bot, GitBranch, MousePointer } from 'lucide-react'
import { useEditorStore } from '@/stores/editor-store'
import { BlockHistoryEntry } from '@/hooks/useBlockHistory'
import { cn, formatRelativeTime, getInitials } from '@/lib/utils'

// ── Snapshot ─────────────────────────────────────────────────────────────────────
// Each entry shows only what the block *became* — the timeline itself shows the diff.

function Snapshot({ before, after }: { before: string | null; after: string }) {
  // Deletion
  if (after === '') {
    return (
      <div className="relative pl-3 mt-1">
        <div className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full bg-red-300" />
        <p className="text-[10px] text-red-400 font-medium">Block deleted</p>
      </div>
    )
  }

  // First version (created)
  const barColor = !before ? 'bg-green-400' : 'bg-[var(--color-border-strong)]'

  return (
    <div className="relative pl-3 mt-1">
      <div className={`absolute left-0 top-0 bottom-0 w-[2px] rounded-full ${barColor}`} />
      <p className="text-xs text-[var(--color-text)] leading-relaxed">{after}</p>
    </div>
  )
}

// ── Timeline entry ──────────────────────────────────────────────────────────────

function TimelineEntry({
  change,
  isLatest,
  isLast,
}: {
  change: BlockHistoryEntry
  isLatest: boolean
  isLast: boolean
}) {
  const isAI = change.source === 'meeting' || change.source === 'ai'
  const isDeleted = change.after_content === ''

  const sourceLabel =
    change.source === 'manual'
      ? 'Edited'
      : change.source === 'meeting'
        ? 'Meeting'
        : 'AI'

  return (
    <div className="flex gap-3">
      {/* Rail column */}
      <div className="flex flex-col items-center shrink-0" style={{ width: 22 }}>
        {/* Node */}
        <div
          className={cn(
            'w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 mt-0.5 border',
            isLatest
              ? 'bg-[var(--color-text)] border-[var(--color-text)]'
              : isAI
                ? 'bg-[var(--color-changed-subtle)] border-[var(--color-changed)]'
                : 'bg-[var(--color-surface)] border-[var(--color-border-strong)]'
          )}
        >
          {isAI ? (
            <Bot
              className={cn(
                'w-2.5 h-2.5',
                isLatest ? 'text-[var(--color-surface)]' : 'text-[var(--color-changed)]'
              )}
            />
          ) : (
            <span
              className={cn(
                'text-[7px] font-bold leading-none select-none',
                isLatest ? 'text-[var(--color-surface)]' : 'text-[var(--color-text-muted)]'
              )}
            >
              {getInitials(change.author_name ?? 'U')}
            </span>
          )}
        </div>

        {/* Connecting line */}
        {!isLast && (
          <div
            className="w-px bg-[var(--color-border)] mt-1.5 flex-1"
            style={{ minHeight: 28 }}
          />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 min-w-0', !isLast && 'pb-6')}>
        {/* Meta row */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-[var(--color-text)] leading-tight">
                {isAI ? (change.author_name ?? 'AI') : (change.author_name ?? 'You')}
              </span>
              <span className="text-[9px] text-[var(--color-text-faint)] uppercase tracking-wider font-medium">
                {sourceLabel}
              </span>
              {isLatest && !isDeleted && (
                <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-px rounded-sm bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
                  Current
                </span>
              )}
            </div>
          </div>
          <span className="text-[10px] text-[var(--color-text-faint)] shrink-0 tabular-nums mt-px">
            {formatRelativeTime(new Date(change.created_at))}
          </span>
        </div>

        {/* Meeting reference */}
        {(change.source === 'meeting' || change.source === 'ai') && change.meeting_title && (
          <p className="mt-1 text-[10px] text-[var(--color-changed)] flex items-center gap-1 leading-none">
            <Bot className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{change.meeting_title}</span>
          </p>
        )}

        {/* Snapshot */}
        <Snapshot before={change.before_content} after={change.after_content} />

        {/* AI reason */}
        {change.reason && (
          <p className="mt-2 text-[10px] text-[var(--color-text-faint)] italic leading-relaxed">
            {change.reason}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Origin node ──────────────────────────────────────────────────────────────────
// Synthetic terminal node showing the block's original content before any edits.

function OriginEntry({ content }: { content: string }) {
  return (
    <div className="flex gap-3">
      {/* Rail column — no line below (it's the end) */}
      <div className="flex flex-col items-center shrink-0" style={{ width: 22 }}>
        <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 mt-0.5 border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface)]" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
            Original
          </span>
        </div>
        <div className="relative pl-3">
          <div className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full bg-[var(--color-border)]" />
          <p className="text-xs text-[var(--color-text-faint)] leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  )
}

// ── Empty states ────────────────────────────────────────────────────────────────

function HoverPrompt() {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
      <div className="w-10 h-10 rounded-full bg-[var(--color-sidebar)] flex items-center justify-center mb-3">
        <MousePointer className="w-4 h-4 text-[var(--color-text-faint)]" />
      </div>
      <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
        Hover over a block
      </p>
      <p className="text-[11px] text-[var(--color-text-faint)] leading-relaxed max-w-[170px]">
        Blocks with an amber stripe have change history
      </p>
    </div>
  )
}

function NoHistoryState() {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
      <div className="w-10 h-10 rounded-full bg-[var(--color-sidebar)] flex items-center justify-center mb-3">
        <GitBranch className="w-4 h-4 text-[var(--color-text-faint)]" />
      </div>
      <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">No history yet</p>
      <p className="text-[11px] text-[var(--color-text-faint)] leading-relaxed">
        This block hasn&apos;t been changed
      </p>
    </div>
  )
}

// ── Main panel ──────────────────────────────────────────────────────────────────

interface HistoryPanelProps {
  historyByBlock: Map<string, BlockHistoryEntry[]>
}

export function HistoryPanel({ historyByBlock }: HistoryPanelProps) {
  const { historyPanelOpen, closeHistoryPanel, activeBlockId } = useEditorStore()

  const entries = activeBlockId ? (historyByBlock.get(activeBlockId) ?? []) : []
  const sorted = [...entries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const hasActiveBlock = !!activeBlockId
  const hasHistory = sorted.length > 0

  // The oldest entry's before_content is the original state before any edits
  const oldestEntry = sorted[sorted.length - 1]
  const originContent = oldestEntry?.before_content ?? null

  return (
    <AnimatePresence>
      {historyPanelOpen && (
        <motion.aside
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="w-[300px] shrink-0 flex flex-col bg-[var(--color-surface)] border-l border-[var(--color-border)] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--color-border)] shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text)]">History</h3>
              {hasActiveBlock && hasHistory && (
                <p className="text-[11px] text-[var(--color-text-faint)] mt-0.5">
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
            {!hasActiveBlock ? (
              <HoverPrompt />
            ) : !hasHistory ? (
              <NoHistoryState />
            ) : (
              <div className="px-4 py-5">
                {sorted.map((change, i) => (
                  <TimelineEntry
                    key={change.id}
                    change={change}
                    isLatest={i === 0}
                    isLast={i === sorted.length - 1 && !originContent}
                  />
                ))}
                {originContent && <OriginEntry content={originContent} />}
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
