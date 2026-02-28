'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  History,
  MoreHorizontal,
  Check,
  ChevronRight,
  Loader2,
  Bot,
  Zap,
  Link2,
  FileDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useEditorStore } from '@/stores/editor-store'
import { useProjects } from '@/hooks/useProjects'

interface EditorHeaderProps {
  docId: string
  projectId: string
  saving: boolean
  historyCount?: number
  pendingCount?: number
  status?: 'draft' | 'published'
  onPublish?: () => Promise<void>
  docContent?: unknown
  docTitle?: string
}

// ── Simple markdown export ────────────────────────────────────────────────────
function blocksToMarkdown(blocks: unknown[]): string {
  return (blocks as Array<{
    type: string
    props?: Record<string, unknown>
    content?: Array<{ type: string; text: string; styles?: object }>
    children?: unknown[]
  }>).map((block) => {
    const text = Array.isArray(block.content)
      ? block.content
          .filter((c) => c.type === 'text')
          .map((c) => c.text)
          .join('')
      : ''

    const children = block.children?.length
      ? '\n' + blocksToMarkdown(block.children as unknown[])
      : ''

    switch (block.type) {
      case 'heading': {
        const level = (block.props?.level as number) ?? 1
        return '#'.repeat(level) + ' ' + text + children
      }
      case 'bulletListItem': return '- ' + text + children
      case 'numberedListItem': return '1. ' + text + children
      case 'codeBlock': return '```\n' + text + '\n```'
      case 'quote': return '> ' + text + children
      default: return text + children
    }
  }).join('\n\n')
}

// ── Dropdown menu ─────────────────────────────────────────────────────────────
function MoreMenu({
  docId,
  docTitle,
  docContent,
}: {
  docId: string
  docTitle?: string
  docContent?: unknown
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href)
    toast.success('Link copied to clipboard')
    setOpen(false)
  }, [])

  const exportMarkdown = useCallback(() => {
    if (!docContent || !Array.isArray(docContent)) {
      toast.error('Nothing to export')
      return
    }
    const md = `# ${docTitle ?? 'Untitled'}\n\n` + blocksToMarkdown(docContent as unknown[])
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(docTitle ?? 'untitled').replace(/\s+/g, '-').toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported as Markdown')
    setOpen(false)
  }, [docContent, docTitle])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center justify-center w-7 h-7 rounded-md transition-colors shrink-0',
          open
            ? 'bg-[var(--color-sidebar-hover)] text-[var(--color-text)]'
            : 'text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-sidebar-hover)]'
        )}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md shadow-[var(--shadow-lg)] z-50 py-1 overflow-hidden">
          <button
            onClick={copyLink}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)] transition-colors text-left"
          >
            <Link2 className="w-3.5 h-3.5 shrink-0" />
            Copy link
          </button>
          <button
            onClick={exportMarkdown}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)] transition-colors text-left"
          >
            <FileDown className="w-3.5 h-3.5 shrink-0" />
            Export as Markdown
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main header ───────────────────────────────────────────────────────────────
export function EditorHeader({
  docId,
  projectId,
  saving,
  historyCount = 0,
  pendingCount = 0,
  status = 'published',
  onPublish,
  docContent,
  docTitle,
}: EditorHeaderProps) {
  const router = useRouter()
  const {
    historyPanelOpen, closeHistoryPanel, openHistoryPanel,
    proposalsPanelOpen, openProposalsPanel, closeProposalsPanel,
  } = useEditorStore()
  const { projects } = useProjects()
  const [publishing, setPublishing] = useState(false)

  const project = projects.find((p) => p.id === projectId)

  const toggleHistory = () => {
    if (historyPanelOpen) closeHistoryPanel()
    else openHistoryPanel()
  }

  const toggleProposals = () => {
    if (proposalsPanelOpen) closeProposalsPanel()
    else openProposalsPanel()
  }

  return (
    <header className="flex items-center h-13 px-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0 gap-2">
      {/* Back */}
      <button
        onClick={() => router.push(`/projects/${projectId}`)}
        className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-sidebar-hover)] transition-colors shrink-0"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>

      {/* Breadcrumb */}
      {project && (
        <div className="flex items-center gap-1 text-sm text-[var(--color-text-faint)] shrink-0 min-w-0">
          <span className="text-base leading-none">{project.emoji}</span>
          <span className="hidden sm:block truncate max-w-[120px]">{project.name}</span>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save status */}
      <div className={cn(
        'flex items-center gap-1 text-xs shrink-0 transition-all duration-200',
        saving ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-faint)] opacity-50'
      )}>
        {saving
          ? <><Loader2 className="w-3 h-3 animate-spin" /><span>Saving</span></>
          : <><Check className="w-3 h-3" /><span>Saved</span></>
        }
      </div>

      {status === 'draft' ? (
        /* Draft mode — Publish CTA */
        <button
          onClick={async () => {
            if (!onPublish) return
            setPublishing(true)
            await onPublish()
            setPublishing(false)
          }}
          disabled={publishing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 shrink-0"
        >
          {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          <span>Publish</span>
        </button>
      ) : (
        /* Published mode — AI suggestions + History */
        <>
          {pendingCount > 0 && (
            <button
              onClick={toggleProposals}
              className={cn(
                'relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors shrink-0',
                proposalsPanelOpen
                  ? 'bg-[var(--color-changed-subtle)] text-[var(--color-changed)]'
                  : 'bg-[var(--color-changed-subtle)] text-[var(--color-changed)] hover:opacity-80'
              )}
            >
              <Bot className="w-3.5 h-3.5" />
              <span className="text-xs">{pendingCount} update{pendingCount !== 1 ? 's' : ''}</span>
            </button>
          )}

          <button
            onClick={toggleHistory}
            className={cn(
              'relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors shrink-0',
              historyPanelOpen
                ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)]'
            )}
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-xs">History</span>
            {historyCount > 0 && !historyPanelOpen && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--color-changed)]" />
            )}
          </button>
        </>
      )}

      <MoreMenu docId={docId} docTitle={docTitle} docContent={docContent} />
    </header>
  )
}
