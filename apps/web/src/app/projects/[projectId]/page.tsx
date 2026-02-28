'use client'

import { use, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Plus, Clock, Trash2, ArrowLeft, Bot, Loader2, CalendarDays } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useSettingsStore } from '@/stores/settings-store'
import { Skeleton } from '@/components/ui/Skeleton'
import { useProjects } from '@/hooks/useProjects'
import { formatRelativeTime, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

// ── Meeting import modal ────────────────────────────────────────────────────────

function MeetingImportModal({
  projectId,
  onClose,
  onDone,
}: {
  projectId: string
  onClose: () => void
  onDone: () => void
}) {
  const [title, setTitle] = useState('')
  const [transcript, setTranscript] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'analyzing' | 'done'>('idle')
  const [result, setResult] = useState<{ proposalCount: number; warning?: string } | null>(null)
  const aiModel = useSettingsStore((s) => s.aiModel)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !transcript.trim()) return
    setStatus('saving')
    try {
      const res = await fetch(`/api/projects/${projectId}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), transcript: transcript.trim(), model: aiModel }),
      })
      setStatus('analyzing')
      const data = await res.json()
      const count = Array.isArray(data.proposals) ? data.proposals.length : 0
      setResult({ proposalCount: count, warning: data.warning })
      setStatus('done')
    } catch {
      setStatus('idle')
    }
  }

  if (status === 'done' && result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-[var(--color-surface)] rounded-xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[var(--color-changed-subtle)] flex items-center justify-center">
              <Bot className="w-5 h-5 text-[var(--color-changed)]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text)]">Analysis complete</h3>
              {result.warning ? (
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{result.warning}</p>
              ) : (
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Found <strong>{result.proposalCount}</strong> suggested update{result.proposalCount !== 1 ? 's' : ''} across your docs
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => { onDone(); onClose() }}
            className="w-full py-2 bg-[var(--color-accent)] text-white rounded text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {result.proposalCount > 0 ? 'Review updates →' : 'Close'}
          </button>
        </div>
      </div>
    )
  }

  const busy = status === 'saving' || status === 'analyzing'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--color-surface)] rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-[var(--color-text)] mb-1">Import meeting transcript</h2>
        <p className="text-xs text-[var(--color-text-muted)] mb-5">
          AI will read your docs and the transcript, then suggest block-level updates for your review.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] mb-1.5 block">Meeting title</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Product Review — Feb 27"
              disabled={busy}
              className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-sidebar)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] outline-none focus:border-[var(--color-accent)] transition-colors disabled:opacity-60"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] mb-1.5 block">Transcript</label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste the meeting transcript here…"
              rows={10}
              disabled={busy}
              className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-sidebar)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] outline-none focus:border-[var(--color-accent)] transition-colors resize-none font-mono text-xs disabled:opacity-60"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={busy} className="flex-1 px-4 py-2 rounded border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] transition-colors disabled:opacity-60">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !transcript.trim() || busy}
              className="flex-1 px-4 py-2 rounded bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />{status === 'analyzing' ? 'AI is reading…' : 'Saving…'}</>
              ) : (
                <><Bot className="w-3.5 h-3.5" />Analyze with AI</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Tabs ────────────────────────────────────────────────────────────────────────

type Tab = 'docs' | 'meetings' | 'manage'

// ── Page ────────────────────────────────────────────────────────────────────────

export default function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const { projects, loading, createDocument, deleteProject, deleteDocument } = useProjects()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('docs')
  const [creating, setCreating] = useState(false)
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [meetings, setMeetings] = useState<Array<{ id: string; title: string; created_at: string }>>([])
  const [pendingByDoc, setPendingByDoc] = useState<Record<string, number>>({})
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false)
  const [deletingProject, setDeletingProject] = useState(false)

  const project = projects.find((p) => p.id === projectId)

  const fetchMeetings = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/meetings`)
    const data = await res.json()
    if (Array.isArray(data)) setMeetings(data)
  }, [projectId])

  const fetchPendingCounts = useCallback(async () => {
    if (!project) return
    const counts: Record<string, number> = {}
    await Promise.all(
      project.documents.map(async (doc) => {
        const res = await fetch(`/api/proposed-changes?docId=${doc.id}&status=pending`)
        const data = await res.json()
        counts[doc.id] = Array.isArray(data) ? data.length : 0
      })
    )
    setPendingByDoc(counts)
  }, [project])

  useEffect(() => { fetchMeetings() }, [fetchMeetings])
  useEffect(() => { if (project) fetchPendingCounts() }, [project, fetchPendingCounts])

  const handleNewDoc = async () => {
    setCreating(true)
    await createDocument(project!.id)
    setCreating(false)
  }

  const handleDeleteProject = async () => {
    setDeletingProject(true)
    await deleteProject(project!.id)
    router.push('/')
  }

  const handleMeetingDone = () => {
    fetchMeetings()
    fetchPendingCounts()
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex-1 overflow-y-auto bg-[var(--color-surface)]">
          <div className="max-w-3xl mx-auto px-8 py-10">
            {/* Back link */}
            <Skeleton className="h-4 w-24 mb-8" />
            {/* Project header */}
            <div className="flex items-center gap-4 mb-10">
              <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-3.5 w-72" />
              </div>
              <div className="flex gap-2 shrink-0">
                <Skeleton className="h-8 w-32 rounded" />
                <Skeleton className="h-8 w-24 rounded" />
              </div>
            </div>
            {/* Tabs */}
            <div className="flex gap-4 border-b border-[var(--color-border)] mb-6 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            {/* Doc list */}
            <div className="divide-y divide-[var(--color-border)]">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="w-4 h-4 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  if (!project) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center bg-[var(--color-surface)]">
          <p className="text-[var(--color-text-muted)]">Project not found.</p>
        </div>
      </AppShell>
    )
  }

  const totalPending = Object.values(pendingByDoc).reduce((a, b) => a + b, 0)

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto bg-[var(--color-surface)]">
        <div className="max-w-3xl mx-auto px-8 py-10">

          {/* Back */}
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-8 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            All projects
          </Link>

          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: `${project.color}18` }}>
                {project.emoji}
              </div>
              <div>
                <h1 className="text-xl font-bold text-[var(--color-text)] leading-tight">{project.name}</h1>
                {project.description && (
                  <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{project.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowMeetingModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-changed-subtle)] text-[var(--color-changed)] rounded text-sm font-medium hover:opacity-80 transition-opacity"
              >
                <Bot className="w-3.5 h-3.5" />
                Import meeting
              </button>
              <button
                onClick={handleNewDoc}
                disabled={creating}
                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-accent)] text-white rounded text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                <Plus className="w-3.5 h-3.5" />
                {creating ? 'Creating…' : 'New doc'}
              </button>
            </div>
          </div>

          {/* Pending updates banner */}
          {totalPending > 0 && (
            <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-lg bg-[var(--color-changed-subtle)] border border-[color-mix(in_srgb,var(--color-changed)_25%,transparent)]">
              <Bot className="w-4 h-4 text-[var(--color-changed)] shrink-0" />
              <p className="text-sm text-[var(--color-changed)]">
                <strong>{totalPending}</strong> AI-suggested update{totalPending !== 1 ? 's' : ''} — open a doc to review
              </p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-[var(--color-border)] mb-6">
            {([
              { key: 'docs', label: `Documents (${project.documents.length})` },
              { key: 'meetings', label: `Meetings (${meetings.length})` },
              { key: 'manage', label: 'Manage' },
            ] as { key: Tab; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  tab === key
                    ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab: Documents */}
          {tab === 'docs' && (
            <>
              {project.documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 border border-dashed border-[var(--color-border)] rounded-lg">
                  <FileText className="w-8 h-8 text-[var(--color-text-faint)] mb-3" />
                  <p className="text-sm text-[var(--color-text-muted)] mb-4">No documents yet</p>
                  <button onClick={handleNewDoc} className="text-sm px-4 py-2 bg-[var(--color-accent)] text-white rounded hover:opacity-90 transition-opacity">
                    Create first doc
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {project.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 py-3">
                      <FileText className="w-4 h-4 text-[var(--color-text-faint)] shrink-0" />
                      <Link href={`/docs/${doc.id}`} className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-[var(--color-text)] truncate hover:underline">{doc.title}</p>
                          {(pendingByDoc[doc.id] ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--color-changed-subtle)] text-[var(--color-changed)] shrink-0">
                              <Bot className="w-2.5 h-2.5" />
                              {pendingByDoc[doc.id]}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-text-faint)] flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(new Date(doc.updated_at))}
                        </p>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Tab: Meetings */}
          {tab === 'meetings' && (
            <>
              {meetings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 border border-dashed border-[var(--color-border)] rounded-lg">
                  <CalendarDays className="w-8 h-8 text-[var(--color-text-faint)] mb-3" />
                  <p className="text-sm text-[var(--color-text-muted)] mb-4">No meetings imported yet</p>
                  <button onClick={() => setShowMeetingModal(true)} className="flex items-center gap-2 text-sm px-4 py-2 bg-[var(--color-accent)] text-white rounded hover:opacity-90 transition-opacity">
                    <Bot className="w-3.5 h-3.5" />
                    Import first meeting
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {meetings.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 py-3">
                      <CalendarDays className="w-4 h-4 text-[var(--color-text-faint)] shrink-0" />
                      <span className="text-sm text-[var(--color-text)] flex-1 truncate">{m.title}</span>
                      <span className="text-xs text-[var(--color-text-faint)]">{formatDate(new Date(m.created_at))}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Tab: Manage */}
          {tab === 'manage' && (
            <div className="space-y-6">
              {/* Delete documents */}
              {project.documents.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-3">Documents</h3>
                  <div className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-lg overflow-hidden">
                    {project.documents.map((doc) => (
                      <DeleteDocRow key={doc.id} doc={doc} onDelete={deleteDocument} />
                    ))}
                  </div>
                </div>
              )}

              {/* Delete project */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-3">Danger zone</h3>
                <div className="border border-red-200 rounded-lg p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">Delete project</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      Permanently deletes this project and all its documents. Cannot be undone.
                    </p>
                  </div>
                  {confirmDeleteProject ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={handleDeleteProject} disabled={deletingProject} className="text-xs px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-60 font-medium">
                        {deletingProject ? 'Deleting…' : 'Confirm delete'}
                      </button>
                      <button onClick={() => setConfirmDeleteProject(false)} className="text-xs px-3 py-1.5 border border-[var(--color-border)] rounded hover:bg-[var(--color-sidebar-hover)]">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteProject(true)} className="flex items-center gap-2 text-xs px-3 py-1.5 border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors shrink-0 font-medium">
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete project
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {showMeetingModal && (
        <MeetingImportModal
          projectId={projectId}
          onClose={() => setShowMeetingModal(false)}
          onDone={handleMeetingDone}
        />
      )}
    </AppShell>
  )
}

// ── Delete doc row (manage tab only) ───────────────────────────────────────────

function DeleteDocRow({
  doc,
  onDelete,
}: {
  doc: { id: string; title: string }
  onDelete: (id: string) => void
}) {
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    await onDelete(doc.id)
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[var(--color-surface)]">
      <FileText className="w-4 h-4 text-[var(--color-text-faint)] shrink-0" />
      <span className="text-sm text-[var(--color-text)] flex-1 truncate">{doc.title}</span>
      {confirm ? (
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleDelete} disabled={deleting} className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-60">
            {deleting ? '…' : 'Delete'}
          </button>
          <button onClick={() => setConfirm(false)} className="text-xs px-2 py-1 border border-[var(--color-border)] rounded hover:bg-[var(--color-sidebar-hover)]">
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirm(true)} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      )}
    </div>
  )
}
