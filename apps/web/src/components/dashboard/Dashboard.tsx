'use client'

import Link from 'next/link'
import { Plus, FileText, Clock, ArrowRight, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { useProjects } from '@/hooks/useProjects'
import { formatRelativeTime } from '@/lib/utils'
import { useState } from 'react'

function NewProjectModal({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (data: { name: string; description: string; emoji: string }) => Promise<void>
}) {
  const emojis = ['📄', '⚡', '🚀', '🔍', '💡', '🎯', '📊', '🛠️', '🌱', '🎨']
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('📄')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    await onCreate({ name, description, emoji })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-[var(--color-text)] mb-5">New project</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Emoji picker */}
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] mb-2 block">Icon</label>
            <div className="flex gap-2 flex-wrap">
              {emojis.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors ${emoji === e ? 'bg-[var(--color-accent-subtle)] ring-2 ring-[var(--color-accent)]' : 'bg-[var(--color-sidebar)] hover:bg-[var(--color-sidebar-hover)]'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] mb-1.5 block">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q2 Roadmap"
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-sidebar)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] mb-1.5 block">Description <span className="font-normal opacity-60">(optional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this project about?"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-sidebar)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] outline-none focus:border-[var(--color-accent)] transition-colors resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Create project
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function Dashboard() {
  const { projects, loading, createProject } = useProjects()
  const [showNewProject, setShowNewProject] = useState(false)

  const allDocs = projects
    .flatMap((p) => p.documents.map((d) => ({ ...d, project: p })))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

  const handleCreateProject = async (data: { name: string; description: string; emoji: string }) => {
    await createProject(data)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)] tracking-tight mb-1">
              Projects
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              {loading ? '…' : `${projects.length} project${projects.length !== 1 ? 's' : ''} · ${allDocs.length} document${allDocs.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => setShowNewProject(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            New project
          </button>
        </div>

        {/* Projects grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <Skeleton className="w-4 h-4 rounded" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
                <Skeleton className="h-3 w-1/3 mt-2" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="mb-2">
              <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-3">
                All projects
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project) => {
                  return (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="group block bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 hover:border-[var(--color-border-strong)] hover:shadow-sm transition-all duration-150"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                          style={{ backgroundColor: `${project.color}18` }}
                        >
                          {project.emoji}
                        </div>
                        <ArrowRight className="w-4 h-4 text-[var(--color-text-faint)] opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                      </div>
                      <h3 className="font-semibold text-[var(--color-text)] text-[15px] leading-tight mb-1">
                        {project.name}
                      </h3>
                      {project.description && (
                        <p className="text-sm text-[var(--color-text-muted)] line-clamp-2 leading-relaxed mb-4">
                          {project.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-faint)]">
                        <FileText className="w-3.5 h-3.5" />
                        <span>{project.documents.length} doc{project.documents.length !== 1 ? 's' : ''}</span>
                      </div>
                    </Link>
                  )
                })}

                {/* New project card */}
                <button
                  onClick={() => setShowNewProject(true)}
                  className="group flex flex-col items-center justify-center gap-2 bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-xl p-5 hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] transition-all duration-150 min-h-[160px]"
                >
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-border)] group-hover:bg-white flex items-center justify-center transition-colors">
                    <Plus className="w-5 h-5 text-[var(--color-text-faint)] group-hover:text-[var(--color-accent)]" />
                  </div>
                  <span className="text-sm text-[var(--color-text-faint)] group-hover:text-[var(--color-accent)] font-medium transition-colors">
                    New project
                  </span>
                </button>
              </div>
            </div>

            {/* Recent docs */}
            {allDocs.length > 0 && (
              <div className="mt-10">
                <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-3">
                  Recently updated
                </h2>
                <div className="space-y-0.5">
                  {allDocs.slice(0, 6).map(({ project, ...doc }) => (
                    <Link
                      key={doc.id}
                      href={`/docs/${doc.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--color-sidebar-hover)] transition-colors group"
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                        style={{ backgroundColor: `${project.color}18` }}
                      >
                        {project.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text)] truncate">{doc.title}</p>
                        <p className="text-xs text-[var(--color-text-faint)]">{project.name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="flex items-center gap-1 text-xs text-[var(--color-text-faint)]">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(new Date(doc.updated_at))}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-faint)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreate={handleCreateProject}
        />
      )}
    </div>
  )
}
