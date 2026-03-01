'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSettingsStore } from '@/stores/settings-store'
import { useAuth } from '@/providers/AuthProvider'
import { cn } from '@/lib/utils'
import { Copy, Check, Link2, Trash2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

// ── Team Section ───────────────────────────────────────────────────────────────

interface OrgMember {
  user_id: string
  role: string
  display_name: string | null
  avatar_url: string | null
  joined_at: string
}

interface Invitation {
  id: string
  token: string
  email: string | null
  role: string
  expires_at: string
}

function MemberAvatar({ name, url }: { name: string | null; url: string | null }) {
  const initials = (name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={name ?? ''} className="w-8 h-8 rounded-full object-cover shrink-0" />
    )
  }
  return (
    <div className="w-8 h-8 rounded-full bg-[var(--color-accent)] text-white text-xs font-semibold flex items-center justify-center shrink-0">
      {initials}
    </div>
  )
}

function TeamSection() {
  const { user, org, member } = useAuth()
  const [members, setMembers] = useState<OrgMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [creatingInvite, setCreatingInvite] = useState(false)

  const isAdmin = member?.role === 'owner' || member?.role === 'admin'

  const fetchTeam = useCallback(async () => {
    if (!org) return
    setLoading(true)
    try {
      const [membersRes, invitesRes] = await Promise.all([
        fetch(`/api/orgs/${org.id}/members`),
        fetch(`/api/orgs/${org.id}/invitations`),
      ])
      const [membersData, invitesData] = await Promise.all([membersRes.json(), invitesRes.json()])
      if (!membersData.error) setMembers(membersData)
      if (!invitesData.error) setInvitations(invitesData)
    } finally {
      setLoading(false)
    }
  }, [org])

  useEffect(() => { fetchTeam() }, [fetchTeam])

  const createInviteLink = async () => {
    if (!org || creatingInvite) return
    setCreatingInvite(true)
    try {
      const res = await fetch(`/api/orgs/${org.id}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'member' }),
      })
      const data = await res.json()
      if (data.error) { toast.error('Failed to create invite link'); return }
      await fetchTeam()
      // Auto-copy the new link
      const url = `${window.location.origin}/invite/${data.token}`
      navigator.clipboard.writeText(url).catch(() => {})
      setCopiedToken(data.token)
      setTimeout(() => setCopiedToken(null), 2000)
      toast.success('Invite link created and copied')
    } catch {
      toast.error('Failed to create invite link')
    } finally {
      setCreatingInvite(false)
    }
  }

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 2000)
      toast.success('Invite link copied')
    })
  }

  const revokeInvite = async (inviteId: string) => {
    if (!org) return
    try {
      await fetch(`/api/orgs/${org.id}/invitations?inviteId=${inviteId}`, { method: 'DELETE' })
      setInvitations((prev) => prev.filter((i) => i.id !== inviteId))
      toast.success('Invite revoked')
    } catch {
      toast.error('Failed to revoke invite')
    }
  }

  const removeMember = async (userId: string) => {
    if (!org || userId === user?.id) return
    try {
      await fetch(`/api/orgs/${org.id}/members?userId=${userId}`, { method: 'DELETE' })
      setMembers((prev) => prev.filter((m) => m.user_id !== userId))
      toast.success('Member removed')
    } catch {
      toast.error('Failed to remove member')
    }
  }

  if (!org) return null

  return (
    <div className="space-y-4">
      {/* Invite link */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
            Invite people
          </p>
          <button
            onClick={fetchTeam}
            disabled={loading}
            className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          </button>
        </div>

        {invitations.length > 0 ? (
          <div className="space-y-1.5 mb-3">
            {invitations.map((inv) => {
              const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${inv.token}`
              const copied = copiedToken === inv.token
              return (
                <div
                  key={inv.id}
                  className="flex items-center gap-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-3 py-2"
                >
                  <Link2 className="w-3.5 h-3.5 text-[var(--color-text-faint)] shrink-0" />
                  <code className="flex-1 text-xs text-[var(--color-text-muted)] font-mono truncate">
                    {url}
                  </code>
                  <span className="text-[10px] text-[var(--color-text-faint)] shrink-0">
                    expires {new Date(inv.expires_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => copyInviteLink(inv.token)}
                    className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors shrink-0"
                    title="Copy link"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-success)]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => revokeInvite(inv.id)}
                      className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] transition-colors shrink-0"
                      title="Revoke invite"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : null}

        {isAdmin && (
          <button
            onClick={createInviteLink}
            disabled={creatingInvite}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors disabled:opacity-60 w-full"
          >
            <Link2 className="w-3.5 h-3.5 shrink-0" />
            {creatingInvite ? 'Creating…' : 'Generate invite link'}
          </button>
        )}

        {!isAdmin && invitations.length === 0 && (
          <p className="text-sm text-[var(--color-text-faint)] py-1">
            Ask a workspace owner or admin to generate an invite link.
          </p>
        )}
      </div>

      {/* Members list */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-2">
          Members ({members.length})
        </p>
        {loading && members.length === 0 ? (
          <p className="text-sm text-[var(--color-text-faint)]">Loading…</p>
        ) : (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden divide-y divide-[var(--color-border)]">
            {members.map((m) => {
              const isYou = m.user_id === user?.id
              return (
                <div key={m.user_id} className="flex items-center gap-3 px-4 py-3">
                  <MemberAvatar name={m.display_name} url={m.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">
                      {m.display_name ?? 'Unknown'}
                      {isYou && <span className="ml-1.5 text-[10px] text-[var(--color-text-faint)]">(you)</span>}
                    </p>
                    <p className="text-xs text-[var(--color-text-faint)] truncate">
                      Joined {new Date(m.joined_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={cn(
                    'text-[10px] font-medium px-2 py-0.5 rounded border font-mono shrink-0',
                    m.role === 'owner'
                      ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-subtle)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-faint)]'
                  )}>
                    {m.role}
                  </span>
                  {isAdmin && !isYou && m.role !== 'owner' && (
                    <button
                      onClick={() => removeMember(m.user_id)}
                      className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] transition-colors shrink-0"
                      title="Remove member"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Primitives ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-2 px-1">
        {title}
      </p>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden divide-y divide-[var(--color-border)]">
        {children}
      </div>
    </div>
  )
}

function Row({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--color-text)]">{label}</p>
        {description && (
          <p className="text-xs text-[var(--color-text-faint)] mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex bg-[var(--color-sidebar)] border border-[var(--color-border)] rounded-md p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded transition-colors',
            value === opt.value
              ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm border border-[var(--color-border)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Settings view ───────────────────────────────────────────────────────────────

export function SettingsView() {
  const { authorName, authorColor, theme, defaultDocStatus, autoSaveDelay, aiModel, update } =
    useSettingsStore()
  const { org } = useAuth()

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--color-bg)]">
      <div className="max-w-2xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-text)] tracking-tight mb-1">
            Settings
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {org ? org.name : 'Preferences saved locally to this browser.'}
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile */}
          <Section title="Profile">
            <Row
              label="Your name"
              description="Shown in block history when you make edits"
            >
              <input
                type="text"
                value={authorName}
                onChange={(e) => update({ authorName: e.target.value || 'You' })}
                className="w-36 px-3 py-1.5 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-sidebar)] text-[var(--color-text)] outline-none focus:border-[var(--color-border-strong)] transition-colors"
              />
            </Row>
            <Row
              label="Your color"
              description="Accent color used to identify your edits in history"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full border-2 border-[var(--color-border)] shrink-0"
                  style={{ backgroundColor: authorColor }}
                />
                <input
                  type="color"
                  value={authorColor}
                  onChange={(e) => update({ authorColor: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                  title="Pick your color"
                />
              </div>
            </Row>
          </Section>

          {/* Appearance */}
          <Section title="Appearance">
            <Row label="Theme" description="Switch between light and dark mode">
              <SegmentedControl
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
                value={theme}
                onChange={(v) => update({ theme: v })}
              />
            </Row>
          </Section>

          {/* Editor */}
          <Section title="Editor">
            <Row
              label="New doc default"
              description="Whether newly created documents start tracking history immediately"
            >
              <SegmentedControl
                options={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'published', label: 'Published' },
                ]}
                value={defaultDocStatus}
                onChange={(v) => update({ defaultDocStatus: v })}
              />
            </Row>
            <Row
              label="Auto-save speed"
              description="How quickly changes are saved after you stop typing"
            >
              <SegmentedControl
                options={[
                  { value: '400', label: 'Fast' },
                  { value: '800', label: 'Normal' },
                  { value: '2000', label: 'Slow' },
                ]}
                value={String(autoSaveDelay)}
                onChange={(v) =>
                  update({ autoSaveDelay: Number(v) as 400 | 800 | 2000 })
                }
              />
            </Row>
          </Section>

          {/* AI */}
          <Section title="AI">
            <Row
              label="Model"
              description="Used when generating document proposals from meeting transcripts"
            >
              <SegmentedControl
                options={[
                  { value: 'claude-haiku-4-5-20251001', label: 'Haiku' },
                  { value: 'claude-sonnet-4-6', label: 'Sonnet' },
                ]}
                value={aiModel}
                onChange={(v) => update({ aiModel: v as typeof aiModel })}
              />
            </Row>
            <Row
              label="API key"
              description="Configured server-side via ANTHROPIC_API_KEY environment variable"
            >
              <span className="text-xs text-[var(--color-text-faint)] font-mono bg-[var(--color-sidebar)] border border-[var(--color-border)] px-2.5 py-1 rounded">
                sk-ant-••••••••
              </span>
            </Row>
          </Section>

          {/* Team */}
          {org && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-4 px-1">
                Team
              </p>
              <TeamSection />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
