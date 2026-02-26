'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  History,
  Share2,
  MoreHorizontal,
  Check,
  ChevronRight,
  Loader2,
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
}

export function EditorHeader({ docId, title, projectId, saving, onTitleChange, historyCount = 0 }: EditorHeaderProps) {
  const router = useRouter()
  const { historyPanelOpen, closeHistoryPanel, openHistoryPanel } = useEditorStore()
  const { projects } = useProjects()
  const [localTitle, setLocalTitle] = useState(title)

  useEffect(() => {
    setLocalTitle(title)
  }, [title])

  const project = projects.find((p) => p.id === projectId)

  const handleTitleBlur = () => {
    if (localTitle !== title) {
      onTitleChange(localTitle)
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
  }

  return (
    <header className="flex items-center h-13 px-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0 gap-2">
      {/* Back */}
      <button
        onClick={() => router.push('/')}
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

      {/* History */}
      <button
        onClick={() => historyPanelOpen ? closeHistoryPanel() : openHistoryPanel()}
        className={cn(
          'relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors shrink-0',
          historyPanelOpen
            ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)]'
        )}
      >
        <History className="w-3.5 h-3.5" />
        <span className="hidden md:inline text-xs">History</span>
        {/* Amber dot — visible when there's history and the panel is closed */}
        {historyCount > 0 && !historyPanelOpen && (
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--color-changed)]" />
        )}
      </button>

      {/* Share */}
      <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--color-accent)] text-white rounded-md text-xs font-medium hover:opacity-90 transition-opacity shrink-0">
        <Share2 className="w-3.5 h-3.5" />
        <span className="hidden md:inline">Share</span>
      </button>

      <button className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-sidebar-hover)] transition-colors shrink-0">
        <MoreHorizontal className="w-4 h-4" />
      </button>
    </header>
  )
}
