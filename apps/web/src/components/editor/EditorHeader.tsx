'use client'

import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEditorStore } from '@/stores/editor-store'
import { useProjects } from '@/hooks/useProjects'

interface EditorHeaderProps {
  docId: string
  title: string
  projectId: string
  saving: boolean
  onTitleChange: (title: string) => Promise<void>
  historyCount?: number
  pendingCount?: number
  status?: 'draft' | 'published'
  onPublish?: () => Promise<void>
}

export function EditorHeader({
  docId,
  title,
  projectId,
  saving,
  onTitleChange,
  historyCount = 0,
  pendingCount = 0,
  status = 'published',
  onPublish,
}: EditorHeaderProps) {
  const router = useRouter()
  const {
    historyPanelOpen, closeHistoryPanel, openHistoryPanel,
    proposalsPanelOpen, openProposalsPanel, closeProposalsPanel,
  } = useEditorStore()
  const { projects } = useProjects()
  const [localTitle, setLocalTitle] = useState(title)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => { setLocalTitle(title) }, [title])

  const project = projects.find((p) => p.id === projectId)

  const handleTitleBlur = () => {
    if (localTitle !== title) onTitleChange(localTitle)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
  }

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
        <div className="hidden sm:flex items-center gap-1 text-sm text-[var(--color-text-faint)] shrink-0">
          <span className="text-base">{project.emoji}</span>
          <span>{project.name}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      )}

      {/* Title */}
      <input
        value={localTitle}
        onChange={(e) => setLocalTitle(e.target.value)}
        onBlur={handleTitleBlur}
        onKeyDown={handleTitleKeyDown}
        className="flex-1 min-w-0 text-sm font-medium text-[var(--color-text)] bg-transparent outline-none border-none placeholder:text-[var(--color-text-faint)] hover:bg-[var(--color-sidebar-hover)] focus:bg-[var(--color-sidebar-hover)] rounded-md px-2 py-1 -ml-1 transition-colors"
        placeholder="Untitled"
      />

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

      <button className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-sidebar-hover)] transition-colors shrink-0">
        <MoreHorizontal className="w-4 h-4" />
      </button>
    </header>
  )
}
