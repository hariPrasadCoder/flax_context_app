'use client'

import { use, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FileText, Plus, Clock, Trash2, ArrowLeft, Bot, Loader2, CalendarDays, ChevronDown, ChevronRight as ChevronRightIcon, Globe, Lock, EyeOff, UserRound, Users } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings-store'
import { Skeleton } from '@/components/ui/Skeleton'
import { useProjects } from '@/hooks/useProjects'
import { useAuth } from '@/providers/AuthProvider'
import { formatRelativeTime, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Project access section ───────────────────────────────────────────────────────

const VISIBILITY_OPTIONS = [
  { value: 'workspace', icon: Globe,   label: 'Workspace', desc: 'All workspace members' },
  { value: 'restricted', icon: Lock,   label: 'Restricted', desc: 'Specific people only' },
  { value: 'private',   icon: EyeOff,  label: 'Private',    desc: 'Only you' },
]

interface ProjectMember {
  userId: string
  role: 'editor' | 'viewer'
  displayName: string | null
  avatarUrl: string | null
}

interface OrgMemberRow {
  user_id: string
  role: string
  display_name: string | null
  avatar_url: string | null
}

function MemberAvatar({ name, url }: { name: string | null; url: string | null }) {
  const initials = (name ?? '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  if (url) return <img src={url} alt={name ?? ''} className="w-7 h-7 rounded-full object-cover shrink-0" />
  return (
    <div className="w-7 h-7 rounded-full bg-[var(--color-accent)] text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
      {initials}
    </div>
  )
}

function ProjectAccessSection({
  projectId,
  orgId,
  initialVisibility,
  onVisibilityChange,
}: {
  projectId: string
  orgId: string
  initialVisibility: string
  onVisibilityChange: (v: string) => void
}) {
  const [visibility, setVisibility] = useState(initialVisibility)
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [orgMembers, setOrgMembers] = useState<OrgMemberRow[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [savingVisibility, setSavingVisibility] = useState(false)
  const [addUserId, setAddUserId] = useState('')
  const [addRole, setAddRole] = useState<'editor' | 'viewer'>('editor')
  const [addingMember, setAddingMember] = useState(false)

  useEffect(() => { setVisibility(initialVisibility) }, [initialVisibility])

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true)
    try {
      const [membersRes, orgRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/members`),
        fetch(`/api/orgs/${orgId}/members`),
      ])
      const [membersData, orgData] = await Promise.all([membersRes.json(), orgRes.json()])
      if (!membersData.error) setMembers(membersData)
      if (!orgData.error) setOrgMembers(orgData)
    } finally {
      setLoadingMembers(false)
    }
  }, [projectId, orgId])

  useEffect(() => {
    if (visibility === 'restricted') loadMembers()
  }, [visibility, loadMembers])

  const handleVisibilityChange = async (newVis: string) => {
    if (newVis === visibility || savingVisibility) return
    setSavingVisibility(true)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVis }),
      })
      const data = await res.json()
      if (data.error) { toast.error('Failed to update access'); return }
      setVisibility(newVis)
      onVisibilityChange(newVis)
      if (newVis === 'restricted') loadMembers()
    } catch {
      toast.error('Failed to update access')
    } finally {
      setSavingVisibility(false)
    }
  }

  const handleAddMember = async () => {
    if (!addUserId || addingMember) return
    setAddingMember(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: addUserId, role: addRole }),
      })
      const data = await res.json()
      if (data.error) { toast.error('Failed to add member'); return }
      toast.success('Member added')
      setAddUserId('')
      await loadMembers()
    } catch {
      toast.error('Failed to add member')
    } finally {
      setAddingMember(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members?userId=${userId}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Failed to remove member'); return }
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
      toast.success('Member removed')
    } catch {
      toast.error('Failed to remove member')
    }
  }

  const addedUserIds = new Set(members.map((m) => m.userId))
  const availableToAdd = orgMembers.filter((m) => !addedUserIds.has(m.user_id))

  return (
    <div className="space-y-4">
      {/* Visibility picker */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-2">
          Who can access
        </p>
        <div className="grid grid-cols-3 gap-2">
          {VISIBILITY_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const active = visibility === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => handleVisibilityChange(opt.value)}
                disabled={savingVisibility}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded border text-center transition-all disabled:opacity-60',
                  active
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-text)] hover:bg-[var(--color-sidebar-hover)]'
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium leading-none">{opt.label}</span>
                <span className="text-[10px] leading-snug opacity-70">{opt.desc}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Access details */}
      {visibility === 'workspace' && (
        <div className="flex items-center gap-2.5 py-2 px-3 rounded border border-[var(--color-border)] bg-[var(--color-sidebar)]">
          <Globe className="w-4 h-4 text-[var(--color-text-faint)] shrink-0" />
          <p className="text-sm text-[var(--color-text-muted)]">All workspace members can view and edit this project and its documents.</p>
        </div>
      )}

      {visibility === 'private' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 py-2 px-3 rounded border border-[var(--color-border)] bg-[var(--color-sidebar)]">
            <EyeOff className="w-4 h-4 text-[var(--color-text-faint)] shrink-0" />
            <p className="text-sm text-[var(--color-text-muted)]">Only you can access this project.</p>
          </div>
          <p className="text-xs text-[var(--color-text-faint)] px-1">
            All documents inside are also private. Document-level sharing is disabled.
          </p>
        </div>
      )}

      {visibility === 'restricted' && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-text-faint)] px-1">
            Only the people below can access this project and all its documents. Document-level sharing is disabled — to share a document, add the person here.
          </p>
          {/* Current members */}
          {loadingMembers ? (
            <p className="text-sm text-[var(--color-text-faint)] py-1">Loading…</p>
          ) : members.length > 0 ? (
            <ul className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-md overflow-hidden">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--color-surface)]">
                  <MemberAvatar name={m.displayName} url={m.avatarUrl} />
                  <span className="flex-1 text-sm text-[var(--color-text)] truncate">
                    {m.displayName ?? 'Unknown'}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-faint)] border border-[var(--color-border)] rounded px-1.5 py-0.5 font-mono shrink-0">
                    {m.role}
                  </span>
                  <button
                    onClick={() => handleRemoveMember(m.userId)}
                    className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] transition-colors shrink-0"
                    title="Remove member"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {/* Add member */}
          {!loadingMembers && (
            <div className="flex items-center gap-1.5 pt-1">
              <div className="relative flex-1 min-w-0">
                <UserRound className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-faint)] pointer-events-none" />
                <select
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] appearance-none"
                >
                  <option value="">
                    {availableToAdd.length === 0 ? 'All workspace members added' : 'Add person…'}
                  </option>
                  {availableToAdd.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.display_name ?? m.user_id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
              <select
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as 'editor' | 'viewer')}
                className="text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={handleAddMember}
                disabled={!addUserId || addingMember || availableToAdd.length === 0}
                className="flex items-center justify-center w-8 h-8 rounded bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
                title="Add member"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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
        <div className="bg-[var(--color-surface)] rounded-lg shadow-[var(--shadow-2xl)] border border-[var(--color-border)] w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
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
      <div className="bg-[var(--color-surface)] rounded-lg shadow-[var(--shadow-2xl)] border border-[var(--color-border)] w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
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
  const { org } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab | null) ?? 'docs'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [projectVisibility, setProjectVisibility] = useState<string>('workspace')
  const [creating, setCreating] = useState(false)
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [meetings, setMeetings] = useState<Array<{ id: string; title: string; transcript: string; created_at: string }>>([])
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null)
  const [pendingByDoc, setPendingByDoc] = useState<Record<string, number>>({})
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false)
  const [deletingProject, setDeletingProject] = useState(false)

  const project = projects.find((p) => p.id === projectId)

  useEffect(() => {
    if (project?.visibility) setProjectVisibility(project.visibility)
  }, [project?.visibility])

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
      <div className="flex-1 overflow-y-auto bg-[var(--color-surface)]">
        <div className="max-w-3xl mx-auto px-8 py-10">
          <Skeleton className="h-4 w-24 mb-8" />
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
          <div className="flex gap-4 border-b border-[var(--color-border)] mb-6 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
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
    )
  }

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--color-surface)]">
        <p className="text-[var(--color-text-muted)]">Project not found.</p>
      </div>
    )
  }

  const totalPending = Object.values(pendingByDoc).reduce((a, b) => a + b, 0)

  return (
    <>
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
              <div className="w-12 h-12 rounded-md flex items-center justify-center text-2xl shrink-0 bg-[var(--color-sidebar)]">
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
                  {meetings.map((m) => {
                    const isExpanded = expandedMeeting === m.id
                    return (
                      <div key={m.id}>
                        <button
                          onClick={() => setExpandedMeeting(isExpanded ? null : m.id)}
                          className="w-full flex items-center gap-3 py-3 hover:bg-[var(--color-sidebar-hover)] px-1 rounded-md transition-colors text-left"
                        >
                          <CalendarDays className="w-4 h-4 text-[var(--color-text-faint)] shrink-0" />
                          <span className="text-sm text-[var(--color-text)] flex-1 truncate">{m.title}</span>
                          <span className="text-xs text-[var(--color-text-faint)] shrink-0">{formatDate(new Date(m.created_at))}</span>
                          {isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-faint)] shrink-0" />
                            : <ChevronRightIcon className="w-3.5 h-3.5 text-[var(--color-text-faint)] shrink-0" />
                          }
                        </button>
                        {isExpanded && (
                          <div className="mb-3 mx-1 px-4 py-3 bg-[var(--color-sidebar)] rounded-md border border-[var(--color-border)]">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-2">Transcript</p>
                            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap font-mono">
                              {m.transcript}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* Tab: Manage */}
          {tab === 'manage' && (
            <div className="space-y-6">

              {/* Visibility & access */}
              {org && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-3 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Visibility &amp; access
                  </h3>
                  <ProjectAccessSection
                    projectId={projectId}
                    orgId={org.id}
                    initialVisibility={projectVisibility}
                    onVisibilityChange={setProjectVisibility}
                  />
                </div>
              )}

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
                <div className="border border-[var(--color-error)]/30 rounded-md p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">Delete project</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      Permanently deletes this project and all its documents. Cannot be undone.
                    </p>
                  </div>
                  {confirmDeleteProject ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={handleDeleteProject} disabled={deletingProject} className="text-xs px-3 py-1.5 bg-[var(--color-error)] text-white rounded-md hover:opacity-90 disabled:opacity-60 font-medium transition-opacity">
                        {deletingProject ? 'Deleting…' : 'Confirm delete'}
                      </button>
                      <button onClick={() => setConfirmDeleteProject(false)} className="text-xs px-3 py-1.5 border border-[var(--color-border)] rounded-md hover:bg-[var(--color-sidebar-hover)]">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteProject(true)} className="flex items-center gap-2 text-xs px-3 py-1.5 border border-[var(--color-error)]/40 text-[var(--color-error)] rounded-md hover:bg-[var(--color-error-subtle)] transition-colors shrink-0 font-medium">
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
    </>
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
