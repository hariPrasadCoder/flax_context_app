'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Globe, Lock, EyeOff, UserRound, Trash2, Plus, FolderLock } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface DocMember {
  userId: string
  role: 'editor' | 'viewer'
  displayName: string | null
  avatarUrl: string | null
}

interface OrgMember {
  user_id: string
  role: string
  display_name: string | null
  avatar_url: string | null
}

interface ShareModalProps {
  docId: string
  orgId: string
  projectId: string
  projectVisibility: string   // workspace | restricted | private
  initialVisibility: string
  open: boolean
  onClose: () => void
  onVisibilityChange: (v: string) => void
}

const VISIBILITY_OPTIONS = [
  {
    value: 'workspace',
    icon: Globe,
    label: 'Workspace',
    desc: 'All workspace members',
  },
  {
    value: 'restricted',
    icon: Lock,
    label: 'Restricted',
    desc: 'Specific people only',
  },
  {
    value: 'private',
    icon: EyeOff,
    label: 'Private',
    desc: 'Only you',
  },
]

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={name ?? ''} className="w-7 h-7 rounded-full object-cover shrink-0" />
    )
  }
  const initials = (name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  return (
    <div className="w-7 h-7 rounded-full bg-[var(--color-accent)] text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
      {initials}
    </div>
  )
}

export function ShareModal({
  docId,
  orgId,
  projectId,
  projectVisibility,
  initialVisibility,
  open,
  onClose,
  onVisibilityChange,
}: ShareModalProps) {
  const [visibility, setVisibility] = useState(initialVisibility)
  const [members, setMembers] = useState<DocMember[]>([])
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [savingVisibility, setSavingVisibility] = useState(false)
  const [addUserId, setAddUserId] = useState('')
  const [addRole, setAddRole] = useState<'editor' | 'viewer'>('editor')
  const [addingMember, setAddingMember] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Sync when parent changes
  useEffect(() => { setVisibility(initialVisibility) }, [initialVisibility])

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true)
    try {
      const [membersRes, orgRes] = await Promise.all([
        fetch(`/api/documents/${docId}/members`),
        fetch(`/api/orgs/${orgId}/members`),
      ])
      const [membersData, orgData] = await Promise.all([membersRes.json(), orgRes.json()])
      if (!membersData.error) setMembers(membersData)
      if (!orgData.error) setOrgMembers(orgData)
    } finally {
      setLoadingMembers(false)
    }
  }, [docId, orgId])

  useEffect(() => {
    if (open && visibility === 'restricted') {
      loadMembers()
    }
  }, [open, visibility, loadMembers])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  const handleVisibilityChange = async (newVis: string) => {
    if (newVis === visibility || savingVisibility) return
    setSavingVisibility(true)
    try {
      const res = await fetch(`/api/documents/${docId}`, {
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
      const res = await fetch(`/api/documents/${docId}/members`, {
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
      const res = await fetch(`/api/documents/${docId}/members?userId=${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) { toast.error('Failed to remove member'); return }
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
      toast.success('Member removed')
    } catch {
      toast.error('Failed to remove member')
    }
  }

  const addedUserIds = new Set(members.map((m) => m.userId))
  const availableToAdd = orgMembers.filter((m) => !addedUserIds.has(m.user_id))

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="w-full max-w-[420px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md shadow-[var(--shadow-lg)] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Share &amp; access</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-6 h-6 rounded text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-sidebar-hover)] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 space-y-5">

          {projectVisibility !== 'workspace' ? (
            /* ── Project controls access — doc has no independent visibility ── */
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded border border-[var(--color-border)] bg-[var(--color-sidebar)]">
                <FolderLock className="w-4 h-4 text-[var(--color-text-faint)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    Access controlled by the project
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                    {projectVisibility === 'restricted'
                      ? 'This document is inside a restricted project. Only people with access to the project can see it. To add or remove someone, update the project\'s access settings.'
                      : 'This document is inside a private project. Only the project owner can access it.'}
                  </p>
                </div>
              </div>
              <a
                href={`/projects/${projectId}?tab=manage`}
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)] transition-colors"
              >
                Go to project settings →
              </a>
            </div>
          ) : (
            /* ── Project is workspace — document controls its own access ── */
            <>
              {/* Visibility picker */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-2">
                  Who can access
                </p>
                <div className="grid grid-cols-3 gap-1.5">
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
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-2">
                  Access
                </p>

                {visibility === 'workspace' && (
                  <div className="flex items-center gap-2.5 py-2 px-3 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    <Globe className="w-4 h-4 text-[var(--color-text-faint)] shrink-0" />
                    <p className="text-sm text-[var(--color-text-muted)]">
                      All workspace members can view and edit.
                    </p>
                  </div>
                )}

                {visibility === 'private' && (
                  <div className="flex items-center gap-2.5 py-2 px-3 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    <EyeOff className="w-4 h-4 text-[var(--color-text-faint)] shrink-0" />
                    <p className="text-sm text-[var(--color-text-muted)]">Only you can access this document.</p>
                  </div>
                )}

                {visibility === 'restricted' && (
                  <div className="space-y-2">
                    {/* Current members */}
                    {loadingMembers ? (
                      <p className="text-sm text-[var(--color-text-faint)] py-2 text-center">Loading…</p>
                    ) : members.length > 0 ? (
                      <ul className="space-y-1">
                        {members.map((m) => (
                          <li
                            key={m.userId}
                            className="flex items-center justify-between gap-2 py-1.5 px-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar name={m.displayName} url={m.avatarUrl} />
                              <span className="text-sm text-[var(--color-text)] truncate">
                                {m.displayName ?? 'Unknown'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-[var(--color-text-faint)] border border-[var(--color-border)] rounded px-1.5 py-0.5 font-mono">
                                {m.role}
                              </span>
                              <button
                                onClick={() => handleRemoveMember(m.userId)}
                                className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] transition-colors"
                                title="Remove member"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {/* Add member row — always shown when restricted and not loading */}
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
