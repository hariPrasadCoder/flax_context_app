'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  FilePlus,
  FileText,
  Settings,
  Zap,
  Plus,
  Search,
  LogOut,
  ChevronsUpDown,
  CalendarDays,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import { useProjects } from '@/hooks/useProjects'
import { useAuth } from '@/providers/AuthProvider'

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

function DocItem({ doc, onClose }: { doc: DocumentRow; onClose?: () => void }) {
  const pathname = usePathname()
  const isActive = pathname === `/docs/${doc.id}`

  return (
    <Link
      href={`/docs/${doc.id}`}
      onClick={onClose}
      className={cn(
        'flex items-center gap-2 rounded-md text-sm transition-colors duration-100 py-1',
        isActive
          ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-medium'
          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)]'
      )}
      style={{ paddingLeft: '22px', paddingRight: '8px' }}
    >
      <FileText
        className={cn(
          'w-3.5 h-3.5 shrink-0',
          isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-faint)]'
        )}
      />
      <span className="truncate">{doc.title}</span>
    </Link>
  )
}

function ProjectItem({
  project,
  onNewDoc,
  onClose,
}: {
  project: ProjectRow
  onNewDoc: (id: string) => void
  onClose?: () => void
}) {
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
            project.documents.map((doc) => <DocItem key={doc.id} doc={doc} onClose={onClose} />)
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

// ── User menu ──────────────────────────────────────────────────────────────────
function UserMenu({ collapsed }: { collapsed?: boolean }) {
  const { user, org, member, signOut } = useAuth()
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

  const displayName = member?.display_name ?? user?.email ?? 'You'
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const avatar = member?.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={member.avatar_url}
      alt={displayName}
      className="w-6 h-6 rounded-full shrink-0 object-cover"
    />
  ) : (
    <div className="w-6 h-6 rounded-full bg-[var(--color-accent)] text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
      {initials}
    </div>
  )

  if (collapsed) {
    return (
      <div ref={ref} className="relative flex justify-center w-full">
        <button
          onClick={() => setOpen((v) => !v)}
          title={displayName}
          className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-[var(--color-sidebar-hover)] transition-colors"
        >
          {avatar}
        </button>
        {open && (
          <div className="absolute bottom-full left-0 mb-1 w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md shadow-[var(--shadow-lg)] py-1 z-50">
            <div className="px-3 py-2 border-b border-[var(--color-border)] mb-1">
              <p className="text-xs font-medium text-[var(--color-text)] truncate">{displayName}</p>
              <p className="text-[10px] text-[var(--color-text-faint)] truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => { setOpen(false); signOut() }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-error)] transition-colors text-left"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-[var(--color-sidebar-hover)] transition-colors group"
      >
        {avatar}
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-medium text-[var(--color-text)] truncate leading-tight">{displayName}</p>
          {org && (
            <p className="text-[10px] text-[var(--color-text-faint)] truncate leading-tight">{org.name}</p>
          )}
        </div>
        <ChevronsUpDown className="w-3 h-3 text-[var(--color-text-faint)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md shadow-[var(--shadow-lg)] py-1 z-50">
          <div className="px-3 py-2 border-b border-[var(--color-border)] mb-1">
            <p className="text-xs font-medium text-[var(--color-text)] truncate">{displayName}</p>
            <p className="text-[10px] text-[var(--color-text-faint)] truncate">{user?.email}</p>
          </div>
          <button
            onClick={() => { setOpen(false); signOut() }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-error)] transition-colors text-left"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function useProposalCount() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    fetch('/api/proposed-changes/count')
      .then((r) => r.json())
      .then((d) => setCount(d.count ?? 0))
      .catch(() => {})
  }, [])
  return count
}

interface SidebarProps {
  onSearch?: () => void
  collapsed?: boolean
  onCollapse?: () => void
  onClose?: () => void
}

export function Sidebar({ onSearch, collapsed = false, onCollapse, onClose }: SidebarProps) {
  const { projects, loading, createProject, createDocument } = useProjects()
  const pathname = usePathname()
  const proposalCount = useProposalCount()

  // ── Collapsed (icon-only) mode — desktop only ────────────────────────────
  if (collapsed) {
    return (
      <aside className="flex flex-col w-14 shrink-0 bg-[var(--color-sidebar)] border-r border-[var(--color-border)] h-screen overflow-hidden">
        {/* Logo — click to expand */}
        <div className="flex items-center justify-center h-13 border-b border-[var(--color-border)] shrink-0">
          <button
            onClick={onCollapse}
            title="Expand sidebar"
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-accent)] text-white hover:opacity-80 transition-opacity"
          >
            <Zap className="w-4 h-4" />
          </button>
        </div>

        {/* Projects — emoji icons only */}
        <div className="flex-1 overflow-y-auto py-3 flex flex-col items-center gap-0.5">
          {loading ? (
            <>
              <Skeleton className="w-9 h-9 rounded-md" />
              <Skeleton className="w-9 h-9 rounded-md" />
            </>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                onClick={onCollapse}
                title={project.name}
                className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-[var(--color-sidebar-hover)] text-lg transition-colors"
              >
                {project.emoji}
              </button>
            ))
          )}
        </div>

        {/* Footer — icons only */}
        <div className="shrink-0 border-t border-[var(--color-border)] p-2 flex flex-col items-center gap-0.5">
          <button
            onClick={onSearch}
            title="Search (⌘K)"
            className="w-9 h-9 flex items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)] transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>
          <Link
            href="/meetings"
            title="Meetings"
            className={cn(
              'relative w-9 h-9 flex items-center justify-center rounded-md transition-colors',
              pathname === '/meetings'
                ? 'bg-[var(--color-accent-subtle)] text-[var(--color-text)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)]'
            )}
          >
            <CalendarDays className="w-4 h-4" />
            {proposalCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--color-accent)]" />
            )}
          </Link>
          <Link
            href="/settings"
            title="Settings"
            className={cn(
              'w-9 h-9 flex items-center justify-center rounded-md transition-colors',
              pathname === '/settings'
                ? 'bg-[var(--color-accent-subtle)] text-[var(--color-text)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)]'
            )}
          >
            <Settings className="w-4 h-4" />
          </Link>
          <div className="pt-1 border-t border-[var(--color-border)] mt-0.5 w-full">
            <UserMenu collapsed />
          </div>
          <button
            onClick={onCollapse}
            title="Expand sidebar"
            className="w-9 h-9 flex items-center justify-center rounded-md text-[var(--color-text-faint)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)] transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </aside>
    )
  }

  // ── Expanded mode ────────────────────────────────────────────────────────
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
        {/* Collapse toggle — hidden on mobile */}
        {onCollapse && (
          <button
            onClick={onCollapse}
            title="Collapse sidebar"
            className="hidden md:flex ml-1 p-0.5 rounded-md text-[var(--color-text-faint)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
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
          <div className="space-y-1 px-1">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-1 mb-3">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <Skeleton className="w-5 h-5 rounded shrink-0" />
                  <Skeleton className="flex-1 h-3.5" />
                  <Skeleton className="w-3 h-3 shrink-0" />
                </div>
                <div className="space-y-1 pl-2">
                  <div className="flex items-center gap-2 py-1" style={{ paddingLeft: '22px' }}>
                    <Skeleton className="w-3.5 h-3.5 shrink-0" />
                    <Skeleton className="flex-1 h-3" />
                  </div>
                  <div className="flex items-center gap-2 py-1" style={{ paddingLeft: '22px' }}>
                    <Skeleton className="w-3.5 h-3.5 shrink-0" />
                    <Skeleton className="w-2/3 h-3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-0.5">
            {projects.map((project) => (
              <ProjectItem
                key={project.id}
                project={project}
                onNewDoc={createDocument}
                onClose={onClose}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[var(--color-border)] p-2 space-y-0.5">
        <button
          onClick={onSearch}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)] transition-colors"
        >
          <Search className="w-4 h-4" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="text-[10px] text-[var(--color-text-faint)] bg-[var(--color-border)] px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </button>
        <Link
          href="/meetings"
          className={cn(
            'w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors',
            pathname === '/meetings'
              ? 'bg-[var(--color-accent-subtle)] text-[var(--color-text)] font-medium'
              : 'text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)]'
          )}
        >
          <CalendarDays className="w-4 h-4" />
          <span className="flex-1">Meetings</span>
          {proposalCount > 0 && (
            <span className="text-[10px] font-medium bg-[var(--color-accent)] text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-mono">
              {proposalCount > 99 ? '99+' : proposalCount}
            </span>
          )}
        </Link>
        <Link
          href="/settings"
          className={cn(
            'w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors',
            pathname === '/settings'
              ? 'bg-[var(--color-accent-subtle)] text-[var(--color-text)] font-medium'
              : 'text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)]'
          )}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </Link>

        {/* User / org */}
        <div className="pt-1 border-t border-[var(--color-border)] mt-1">
          <UserMenu />
        </div>
      </div>
    </aside>
  )
}
