'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  FolderPlus,
  FileText,
  Settings,
  Zap,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjects } from '@/hooks/useProjects'

interface DocumentRow {
  id: string
  title: string
  parent_id: string | null
  updated_at: string
  created_at: string
}

interface ProjectRow {
  id: string
  name: string
  description: string | null
  emoji: string
  color: string
  documents: DocumentRow[]
}

function DocItem({ doc }: { doc: DocumentRow }) {
  const pathname = usePathname()
  const isActive = pathname === `/docs/${doc.id}`

  return (
    <Link
      href={`/docs/${doc.id}`}
      className={cn(
        'group flex items-center gap-2 rounded-md text-sm transition-colors duration-100 py-1',
        isActive
          ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-medium'
          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)]'
      )}
      style={{ paddingLeft: '22px', paddingRight: '8px' }}
    >
      <FileText className={cn('w-3.5 h-3.5 shrink-0', isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-faint)]')} />
      <span className="truncate">{doc.title}</span>
    </Link>
  )
}

function ProjectItem({ project, onNewDoc }: { project: ProjectRow; onNewDoc: (id: string) => void }) {
  const pathname = usePathname()
  const isProjectActive = project.documents.some((d) => pathname === `/docs/${d.id}`)
  const [expanded, setExpanded] = useState<boolean>(isProjectActive)
  const [creating, setCreating] = useState(false)

  const handleNewDoc = async () => {
    setCreating(true)
    setExpanded(true)
    await onNewDoc(project.id)
    setCreating(false)
  }

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-colors duration-100',
          'hover:bg-[var(--color-sidebar-hover)]',
          isProjectActive ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'
        )}
      >
        <span className="text-base leading-none shrink-0">{project.emoji}</span>
        <span className="flex-1 text-left truncate">{project.name}</span>
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-faint)] shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-faint)] shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="mt-0.5 mb-1 space-y-0.5">
          {project.documents.length === 0 ? (
            <p className="text-xs text-[var(--color-text-faint)] py-1" style={{ paddingLeft: '22px' }}>
              No documents yet
            </p>
          ) : (
            project.documents.map((doc) => <DocItem key={doc.id} doc={doc} />)
          )}
          <button
            onClick={handleNewDoc}
            disabled={creating}
            className="w-full flex items-center gap-2 text-xs text-[var(--color-text-faint)] hover:text-[var(--color-accent)] py-1 rounded-md hover:bg-[var(--color-sidebar-hover)] transition-colors"
            style={{ paddingLeft: '22px' }}
          >
            <FilePlus className="w-3 h-3" />
            <span>{creating ? 'Creating…' : 'New doc'}</span>
          </button>
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const { projects, loading, createProject, createDocument } = useProjects()

  return (
    <aside className="flex flex-col w-[240px] shrink-0 bg-[var(--color-sidebar)] border-r border-[var(--color-border)] h-screen overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-13 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-accent)] text-white">
          <Zap className="w-4 h-4" />
        </div>
        <span className="font-semibold text-[var(--color-text)] tracking-tight">Flax</span>
        <span className="ml-auto text-[10px] text-[var(--color-text-faint)] bg-[var(--color-border)] px-1.5 py-0.5 rounded-full font-medium">
          Beta
        </span>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
            Projects
          </span>
          <button
            onClick={() => createProject({ name: 'New Project', emoji: '📄', color: '#2563EB' })}
            title="New project"
            className="text-[var(--color-text-faint)] hover:text-[var(--color-accent)] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2 px-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-7 bg-[var(--color-border)] rounded-md animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-0.5">
            {projects.map((project) => (
              <ProjectItem
                key={project.id}
                project={project}
                onNewDoc={createDocument}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[var(--color-border)] p-2">
        <button className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)] transition-colors">
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  )
}
