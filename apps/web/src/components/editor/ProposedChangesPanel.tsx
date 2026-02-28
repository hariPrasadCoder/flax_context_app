'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Bot, Check, Trash2, ChevronsUpDown, Loader2 } from 'lucide-react'
import { useEditorStore } from '@/stores/editor-store'
import { useProposedChanges } from '@/hooks/useProposedChanges'
import { formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

function ProposalCard({
  change,
  onAccept,
  onReject,
}: {
  change: import('@/hooks/useProposedChanges').ProposedChange
  onAccept: () => void
  onReject: () => void
}) {
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null)
  const [expanded, setExpanded] = useState(true)

  const handle = async (action: 'accept' | 'reject') => {
    setBusy(action)
    await (action === 'accept' ? onAccept() : onReject())
    setBusy(null)
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
      {/* Proposal header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[var(--color-sidebar)]">
        <div className="w-5 h-5 rounded-full bg-[var(--color-changed-subtle)] flex items-center justify-center shrink-0">
          <Bot className="w-3 h-3 text-[var(--color-changed)]" />
        </div>
        <span className="text-xs text-[var(--color-text-muted)] flex-1 truncate">
          {change.meetings?.title ?? 'Meeting'}
          {change.meetings?.created_at && (
            <span className="text-[var(--color-text-faint)] ml-1">
              · {formatRelativeTime(new Date(change.meetings.created_at))}
            </span>
          )}
        </span>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors"
        >
          <ChevronsUpDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-3 py-2.5 space-y-2.5">
          {/* Diff */}
          {change.before_content && (
            <div className="relative pl-3">
              <div className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full bg-red-300" />
              <p className="text-xs text-[var(--color-text-muted)] line-through leading-relaxed opacity-75">
                {change.before_content}
              </p>
            </div>
          )}
          <div className="relative pl-3">
            <div className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full bg-green-400" />
            <p className="text-xs text-[var(--color-text)] leading-relaxed">
              {change.after_content}
            </p>
          </div>

          {/* Reason */}
          {change.reason && (
            <p className="text-[11px] text-[var(--color-text-muted)] italic leading-relaxed border-l-2 border-[var(--color-border-strong)] pl-2">
              {change.reason}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-0.5">
            <button
              onClick={() => handle('accept')}
              disabled={busy !== null}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors',
                'bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-60'
              )}
            >
              {busy === 'accept' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Apply
            </button>
            <button
              onClick={() => handle('reject')}
              disabled={busy !== null}
              className={cn(
                'flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
                'border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] disabled:opacity-60'
              )}
            >
              {busy === 'reject' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface ProposedChangesPanelProps {
  docId: string
  onAccepted?: () => void
}

export function ProposedChangesPanel({ docId, onAccepted }: ProposedChangesPanelProps) {
  const { proposalsPanelOpen, closeProposalsPanel } = useEditorStore()
  const { changes, loading, acceptAll } = useProposedChanges(docId)
  const [acceptingAll, setAcceptingAll] = useState(false)

  const handleAcceptAll = async () => {
    setAcceptingAll(true)
    await acceptAll()
    setAcceptingAll(false)
    onAccepted?.()
  }

  return (
    <AnimatePresence>
      {proposalsPanelOpen && (
        <motion.aside
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="w-[320px] shrink-0 flex flex-col bg-[var(--color-surface)] border-l border-[var(--color-border)] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--color-border)] shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text)]">AI suggestions</h3>
              <p className="text-xs text-[var(--color-text-faint)] mt-0.5">
                {loading ? 'Loading…' : `${changes.length} pending update${changes.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <button
              onClick={closeProposalsPanel}
              className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-sidebar-hover)] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-faint)]" />
              </div>
            ) : changes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-10 h-10 rounded-full bg-[var(--color-sidebar)] flex items-center justify-center mb-3">
                  <Check className="w-4 h-4 text-[var(--color-text-faint)]" />
                </div>
                <p className="text-sm font-medium text-[var(--color-text-muted)] mb-1">All clear</p>
                <p className="text-xs text-[var(--color-text-faint)] leading-relaxed max-w-[180px]">
                  No pending AI suggestions for this document
                </p>
              </div>
            ) : (
              changes.map((change) => (
                <ProposalCard
                  key={change.id}
                  change={change}
                  onAccept={async () => {
                    await fetch(`/api/proposed-changes/${change.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'accept' }),
                    })
                    onAccepted?.()
                  }}
                  onReject={async () => {
                    await fetch(`/api/proposed-changes/${change.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'reject' }),
                    })
                  }}
                />
              ))
            )}
          </div>

          {/* Footer — accept all */}
          {changes.length > 1 && (
            <div className="shrink-0 px-4 py-3 border-t border-[var(--color-border)]">
              <button
                onClick={handleAcceptAll}
                disabled={acceptingAll}
                className="w-full flex items-center justify-center gap-2 py-2 bg-[var(--color-accent)] text-white rounded text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {acceptingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Apply all {changes.length} updates
              </button>
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
