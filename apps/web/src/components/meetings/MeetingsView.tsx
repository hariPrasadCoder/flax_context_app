'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/providers/AuthProvider'
import { cn } from '@/lib/utils'
import {
  CalendarDays, Bot, Loader2, CheckCircle2, XCircle, Clock,
  RefreshCw, ChevronDown, ChevronUp, Sparkles, FileText,
  AlertTriangle, RotateCcw, ChevronRight, Play,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ────────────────────────────────────────────────────────────────────

interface OrgMeeting {
  id: string
  meeting_title: string | null
  meeting_url?: string
  platform: string | null
  start_time: string
  end_time: string | null
  bot_status: string
  bot_error: string | null
  recall_bot_id: string | null
  matched_project_id: string | null
  matched_project_name: string | null
  match_confidence: 'high' | 'low' | 'none' | null
  meeting_summary: string | null
  action_items: string[] | null
  has_transcript: boolean
  pending_proposals: number
}

interface MeetingDetail extends OrgMeeting {
  transcript: { segments: Array<{ speaker: string; text: string }> } | null
  proposals: Array<{
    id: string
    doc_id: string
    doc_title: string
    block_id: string
    before_content: string | null
    after_content: string
    reason: string | null
    status: string
  }>
}

interface Project { id: string; name: string; emoji: string }
interface CalendarStatus { connected: boolean; autoJoin?: boolean }

type FilterTab = 'all' | 'upcoming' | 'past' | 'failed'

const ACTIVE_STATUSES = ['dispatched', 'in_call', 'processing']

const BOT_ERROR_LABELS: Record<string, { short: string; hint: string }> = {
  meeting_requires_sign_in: {
    short: 'Sign-in required',
    hint: 'Google Meet only allows signed-in users. Open Meet → Host controls → turn off "Require sign-in".',
  },
  waiting_room_timeout: {
    short: 'Waiting room timeout',
    hint: 'Bot waited 10 minutes to be admitted and left. Admit the bot promptly or disable the waiting room.',
  },
  noone_joined_timeout: {
    short: 'Empty meeting',
    hint: 'Bot joined but no one else was in the meeting for 10 minutes.',
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`
}

function isUpcoming(m: OrgMeeting) { return new Date(m.start_time) > new Date() }
function isActive(m: OrgMeeting) { return ACTIVE_STATUSES.includes(m.bot_status) }
function isDone(m: OrgMeeting) { return m.bot_status === 'done' }
function isFailed(m: OrgMeeting) { return m.bot_status === 'failed' }

// ── Status badge ─────────────────────────────────────────────────────────────

function BotStatusBadge({ meeting }: { meeting: OrgMeeting }) {
  const errorInfo = meeting.bot_error ? BOT_ERROR_LABELS[meeting.bot_error] : null

  const configs: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    pending:    { label: 'Scheduled',   icon: <Clock className="w-3 h-3" />,                       cls: 'text-[var(--color-text-faint)] border-[var(--color-border)]' },
    dispatched: { label: 'Joining…',    icon: <Loader2 className="w-3 h-3 animate-spin" />,         cls: 'text-[var(--color-warning)] border-[var(--color-warning)]/40' },
    in_call:    { label: 'Recording',   icon: <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />, cls: 'text-[var(--color-success)] border-[var(--color-success)]/40' },
    processing: { label: 'Processing',  icon: <Loader2 className="w-3 h-3 animate-spin" />,         cls: 'text-[var(--color-warning)] border-[var(--color-warning)]/40' },
    done:       { label: 'Done',        icon: <CheckCircle2 className="w-3 h-3" />,                 cls: 'text-[var(--color-success)] border-[var(--color-success)]/40' },
    failed:     { label: errorInfo?.short ?? 'Failed', icon: <XCircle className="w-3 h-3" />,      cls: 'text-[var(--color-error)] border-[var(--color-error)]/40' },
  }

  const c = configs[meeting.bot_status] ?? configs.pending
  return (
    <span
      title={errorInfo?.hint}
      className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border font-mono shrink-0', c.cls, errorInfo && 'cursor-help')}
    >
      {c.icon} {c.label}
    </span>
  )
}

// ── Project selector ─────────────────────────────────────────────────────────

function ProjectSelector({
  meetingId, currentProjectId, projects, onLinked,
}: {
  meetingId: string
  currentProjectId: string | null
  projects: Project[]
  onLinked: (projectId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [linking, setLinking] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const link = async (projectId: string) => {
    setLinking(true); setOpen(false)
    try {
      const res = await fetch(`/api/org-meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      })
      if (!res.ok) throw new Error()
      toast.success('Meeting linked — AI analysis queued')
      onLinked(projectId)
    } catch {
      toast.error('Failed to link meeting')
    } finally {
      setLinking(false)
    }
  }

  const current = projects.find((p) => p.id === currentProjectId)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        disabled={linking}
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 rounded px-2 py-1 transition-colors disabled:opacity-60"
      >
        {linking ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        <span>{current ? `${current.emoji} ${current.name}` : 'Link to project'}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md shadow-[var(--shadow-lg)] py-1 z-20">
          {projects.length === 0
            ? <p className="px-3 py-2 text-xs text-[var(--color-text-faint)]">No projects found</p>
            : projects.map((p) => (
              <button
                key={p.id}
                onClick={() => link(p.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                  p.id === currentProjectId
                    ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)]'
                )}
              >
                <span>{p.emoji}</span><span className="truncate">{p.name}</span>
              </button>
            ))
          }
        </div>
      )}
    </div>
  )
}

// ── Meeting detail panel ─────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="px-4 py-4 space-y-3 border-t border-[var(--color-border)] bg-[var(--color-bg)]">
      {[80, 60, 70].map((w, i) => (
        <div key={i} className={`h-3 rounded bg-[var(--color-border)] animate-pulse`} style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}

function TranscriptSection({ segments }: { segments: Array<{ speaker: string; text: string }> }) {
  const [open, setOpen] = useState(false)
  const preview = segments.slice(0, 3)

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors"
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {open ? 'Hide transcript' : 'View transcript'}
      </button>
      {open && (
        <div className="mt-2 max-h-48 overflow-y-auto text-xs text-[var(--color-text-muted)] space-y-1 border border-[var(--color-border)] rounded-md p-3 bg-[var(--color-sidebar)] font-mono leading-relaxed">
          {segments.map((s, i) => (
            <p key={i}><span className="text-[var(--color-text-faint)]">{s.speaker}:</span> {s.text}</p>
          ))}
        </div>
      )}
      {!open && preview.length > 0 && (
        <p className="mt-1 text-xs text-[var(--color-text-faint)] font-mono truncate">
          {preview[0].speaker}: {preview[0].text}…
        </p>
      )}
    </div>
  )
}

function MeetingDetailPanel({
  meeting, detail, projects, onLinked, onRetry,
}: {
  meeting: OrgMeeting
  detail: MeetingDetail | null
  projects: Project[]
  onLinked: (projectId: string) => void
  onRetry: () => void
}) {
  const upcoming = isUpcoming(meeting)
  const active = isActive(meeting)
  const done = isDone(meeting)
  const failed = isFailed(meeting)
  const errorInfo = meeting.bot_error ? BOT_ERROR_LABELS[meeting.bot_error] : null
  const minsUntil = upcoming ? Math.max(0, Math.floor((new Date(meeting.start_time).getTime() - Date.now()) / 60000)) : 0

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 space-y-4" onClick={(e) => e.stopPropagation()}>

      {/* Upcoming */}
      {upcoming && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <Clock className="w-4 h-4 shrink-0 text-[var(--color-text-faint)]" />
            <span>
              {minsUntil === 0
                ? 'Bot is joining now…'
                : `Bot joins automatically in ${minsUntil} minute${minsUntil !== 1 ? 's' : ''}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-faint)]">Project:</span>
            <ProjectSelector
              meetingId={meeting.id}
              currentProjectId={meeting.matched_project_id}
              projects={projects}
              onLinked={onLinked}
            />
          </div>
          {meeting.meeting_url && (
            <p className="text-xs text-[var(--color-text-faint)] font-mono truncate">{meeting.meeting_url}</p>
          )}
        </div>
      )}

      {/* Active / recording */}
      {active && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span>Recording in progress — summary appears when the call ends</span>
        </div>
      )}

      {/* Failed */}
      {failed && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 rounded-md bg-[var(--color-error)]/5 border border-[var(--color-error)]/20">
            <AlertTriangle className="w-4 h-4 text-[var(--color-error)] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[var(--color-error)]">
                {errorInfo?.short ?? 'Bot failed to join'}
              </p>
              {errorInfo?.hint && (
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">{errorInfo.hint}</p>
              )}
            </div>
          </div>
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]/40 transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Retry bot
          </button>
        </div>
      )}

      {/* Done */}
      {done && (
        <div className="space-y-4">
          {/* Summary */}
          {meeting.meeting_summary ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-1.5">Summary</p>
              <div className="text-sm text-[var(--color-text-muted)] leading-relaxed space-y-0.5">
                {meeting.meeting_summary.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--color-text-faint)] italic">Summary not yet generated</p>
          )}

          {/* Action items */}
          {meeting.action_items && meeting.action_items.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-1.5">Action items</p>
              <ul className="space-y-1">
                {meeting.action_items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-muted)]">
                    <span className="mt-1 w-3.5 h-3.5 shrink-0 rounded border border-[var(--color-border)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Project + proposals */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-faint)]">Project:</span>
              <ProjectSelector
                meetingId={meeting.id}
                currentProjectId={meeting.matched_project_id}
                projects={projects}
                onLinked={onLinked}
              />
            </div>
            {meeting.pending_proposals > 0 && (
              <Link
                href={`/projects/${meeting.matched_project_id}`}
                className="inline-flex items-center gap-1.5 text-xs text-[var(--color-accent)] hover:underline"
              >
                <Sparkles className="w-3 h-3" />
                {meeting.pending_proposals} pending proposal{meeting.pending_proposals !== 1 ? 's' : ''} → review in editor
              </Link>
            )}
          </div>

          {/* Proposals list */}
          {detail && detail.proposals.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-1.5">
                Proposed changes ({detail.proposals.filter((p) => p.status === 'pending').length} pending)
              </p>
              <div className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-md overflow-hidden">
                {detail.proposals.map((p) => (
                  <div key={p.id} className="px-3 py-2 bg-[var(--color-surface)]">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-medium text-[var(--color-text)] truncate">{p.doc_title}</span>
                      <span className={cn(
                        'text-[10px] font-mono px-1 rounded border shrink-0',
                        p.status === 'pending' ? 'text-[var(--color-accent)] border-[var(--color-accent)]/30' :
                        p.status === 'accepted' ? 'text-[var(--color-success)] border-[var(--color-success)]/30' :
                        'text-[var(--color-text-faint)] border-[var(--color-border)] line-through'
                      )}>{p.status}</span>
                    </div>
                    <p className="text-xs text-[var(--color-success)] line-clamp-2">{p.after_content}</p>
                    {p.reason && <p className="text-[10px] text-[var(--color-text-faint)] mt-0.5 line-clamp-1">{p.reason}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transcript */}
          {detail?.transcript?.segments?.length ? (
            <TranscriptSection segments={detail.transcript.segments} />
          ) : meeting.has_transcript ? (
            <p className="text-xs text-[var(--color-text-faint)]">Loading transcript…</p>
          ) : null}
        </div>
      )}
    </div>
  )
}

// ── Meeting row ──────────────────────────────────────────────────────────────

function MeetingRow({
  meeting, expanded, onToggle, detail, projects, onMeetingUpdate,
}: {
  meeting: OrgMeeting
  expanded: boolean
  onToggle: () => void
  detail: MeetingDetail | null
  projects: Project[]
  onMeetingUpdate: (id: string, patch: Partial<OrgMeeting>) => void
}) {
  const [retrying, setRetrying] = useState(false)

  const handleRetry = async () => {
    setRetrying(true)
    try {
      const res = await fetch(`/api/org-meetings/${meeting.id}/retry`, { method: 'POST' })
      if (!res.ok) throw new Error()
      onMeetingUpdate(meeting.id, { bot_status: 'dispatched', bot_error: null })
      toast.success('Bot re-dispatched')
    } catch {
      toast.error('Failed to retry — check the meeting is still live')
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div>
      {/* Row header — always visible */}
      <div
        onClick={onToggle}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--color-sidebar-hover)] transition-colors select-none"
      >
        {/* Expand indicator */}
        <div className="shrink-0 text-[var(--color-text-faint)]">
          {expanded
            ? <ChevronUp className="w-3.5 h-3.5" />
            : <ChevronDown className="w-3.5 h-3.5" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-text)] truncate">
            {meeting.meeting_title ?? 'Untitled meeting'}
          </p>
          <p className="text-[10px] text-[var(--color-text-faint)] mt-0.5">
            {formatTime(meeting.start_time)}
            {meeting.platform && <span className="ml-1.5 capitalize">· {meeting.platform.replace('_', ' ')}</span>}
            {meeting.matched_project_name && <span className="ml-1.5 text-[var(--color-accent)]">· {meeting.matched_project_name}</span>}
            {isUpcoming(meeting) && <span className="ml-1.5 font-medium text-[var(--color-warning)]">· in {timeUntil(meeting.start_time)}</span>}
          </p>
        </div>

        {/* Right side chips */}
        <div className="shrink-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {meeting.pending_proposals > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border border-[var(--color-accent)]/40 text-[var(--color-accent)] font-mono">
              <Sparkles className="w-3 h-3" />
              {meeting.pending_proposals}
            </span>
          )}
          {meeting.has_transcript && meeting.pending_proposals === 0 && isDone(meeting) && (
            <FileText className="w-3.5 h-3.5 text-[var(--color-text-faint)]" />
          )}
          {retrying
            ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-text-faint)]" />
            : <BotStatusBadge meeting={meeting} />
          }
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        detail === undefined
          ? <DetailSkeleton />
          : <MeetingDetailPanel
              meeting={meeting}
              detail={detail}
              projects={projects}
              onLinked={(pid) => onMeetingUpdate(meeting.id, { matched_project_id: pid, match_confidence: 'high' })}
              onRetry={handleRetry}
            />
      )}
    </div>
  )
}

// ── Next meeting banner ──────────────────────────────────────────────────────

function NextMeetingBanner({ meetings }: { meetings: OrgMeeting[] }) {
  const next = meetings.find((m) => {
    if (!isUpcoming(m)) return false
    const mins = (new Date(m.start_time).getTime() - Date.now()) / 60000
    return mins <= 10
  }) ?? meetings.find((m) => isActive(m))

  if (!next) return null

  const active = isActive(next)

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium',
      active
        ? 'border-red-400/30 bg-red-50/50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
        : 'border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 text-[var(--color-warning)]'
    )}>
      {active
        ? <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" /> Recording: {next.meeting_title ?? 'Untitled meeting'}</>
        : <><Play className="w-3.5 h-3.5 shrink-0" /> {next.meeting_title ?? 'Untitled meeting'} starts in {timeUntil(next.start_time)} — bot joining automatically</>
      }
    </div>
  )
}

// ── Calendar connection bar ──────────────────────────────────────────────────

function CalendarBar({ calStatus, onRefresh }: { calStatus: CalendarStatus | null; onRefresh: () => void }) {
  const [toggling, setToggling] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const toggleAutoJoin = async () => {
    if (!calStatus?.connected || toggling) return
    setToggling(true)
    try {
      const res = await fetch('/api/calendar/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoJoin: !calStatus.autoJoin }),
      })
      const data = await res.json()
      if (!data.error) { toast.success(data.autoJoin ? 'Auto-join enabled' : 'Auto-join paused'); onRefresh() }
    } catch { toast.error('Failed to update') } finally { setToggling(false) }
  }

  const disconnect = async () => {
    if (disconnecting) return
    setDisconnecting(true)
    try {
      await fetch('/api/calendar/disconnect', { method: 'DELETE' })
      toast.success('Calendar disconnected'); onRefresh()
    } catch { toast.error('Failed to disconnect') } finally { setDisconnecting(false) }
  }

  if (!calStatus) return null

  if (!calStatus.connected) {
    return (
      <div className="flex items-center justify-between p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg">
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">Connect Google Calendar</p>
          <p className="text-xs text-[var(--color-text-faint)] mt-0.5">Bot joins your Google Meet and Zoom calls automatically — one bot per meeting.</p>
        </div>
        <a href="/api/calendar/connect" className="shrink-0 inline-flex items-center gap-2 px-3 py-2 text-sm rounded border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-sidebar-hover)] transition-colors font-medium ml-4">
          <CalendarDays className="w-4 h-4" /> Connect
        </a>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-success)]/30 rounded-lg">
      <CheckCircle2 className="w-4 h-4 text-[var(--color-success)] shrink-0" />
      <span className="text-sm text-[var(--color-text)] flex-1">Google Calendar connected</span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-[var(--color-text-faint)]">Auto-join</span>
        <button
          onClick={toggleAutoJoin} disabled={toggling}
          className={cn('relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-60', calStatus.autoJoin ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]')}
          role="switch" aria-checked={calStatus.autoJoin}
        >
          <span className={cn('pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', calStatus.autoJoin ? 'translate-x-4' : 'translate-x-0')} />
        </button>
      </div>
      <button onClick={disconnect} disabled={disconnecting} className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-error)] transition-colors disabled:opacity-60 shrink-0">
        {disconnecting ? 'Disconnecting…' : 'Disconnect'}
      </button>
    </div>
  )
}

// ── Filter tabs ──────────────────────────────────────────────────────────────

function FilterTabs({ active, onChange, counts }: {
  active: FilterTab
  onChange: (t: FilterTab) => void
  counts: Record<FilterTab, number>
}) {
  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'past', label: 'Past' },
    { id: 'failed', label: 'Failed' },
  ]
  return (
    <div className="flex gap-1 border-b border-[var(--color-border)]">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm transition-colors border-b-2 -mb-px',
            active === t.id
              ? 'border-[var(--color-accent)] text-[var(--color-text)] font-medium'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          )}
        >
          {t.label}
          {counts[t.id] > 0 && (
            <span className={cn('text-[10px] font-mono px-1 rounded', active === t.id ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]' : 'bg-[var(--color-border)] text-[var(--color-text-faint)]')}>
              {counts[t.id]}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── Main view ────────────────────────────────────────────────────────────────

export function MeetingsView() {
  const { org } = useAuth()
  const [meetings, setMeetings] = useState<OrgMeeting[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [calStatus, setCalStatus] = useState<CalendarStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailCache, setDetailCache] = useState<Map<string, MeetingDetail>>(new Map())
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterTab>('all')

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [meetingsRes, calRes, projectsRes] = await Promise.all([
        fetch('/api/org-meetings'),
        fetch('/api/calendar/status'),
        fetch('/api/projects'),
      ])
      const [meetingsData, calData, projectsData] = await Promise.all([
        meetingsRes.json(), calRes.json(), projectsRes.json(),
      ])
      if (!meetingsData.error) setMeetings(meetingsData)
      setCalStatus(calData)
      if (Array.isArray(projectsData)) setProjects(projectsData)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  const syncAndRefresh = useCallback(async () => {
    setSyncing(true)
    try {
      await fetch('/api/calendar/sync', { method: 'POST' })
      await fetchAll(true)
    } catch { toast.error('Sync failed') } finally { setSyncing(false) }
  }, [fetchAll])

  // Initial load + OAuth redirect handling
  useEffect(() => {
    fetchAll()
    const params = new URLSearchParams(window.location.search)
    const cal = params.get('cal')
    if (cal === 'connected') { toast.success('Google Calendar connected'); window.history.replaceState({}, '', window.location.pathname) }
    else if (cal === 'error') { toast.error('Failed to connect Google Calendar'); window.history.replaceState({}, '', window.location.pathname) }
  }, [fetchAll])

  // Auto-poll every 30s when active meetings exist
  useEffect(() => {
    const hasActive = meetings.some((m) => ACTIVE_STATUSES.includes(m.bot_status))
    if (!hasActive) return
    const interval = setInterval(() => fetchAll(true), 30000)
    return () => clearInterval(interval)
  }, [meetings, fetchAll])

  // Expand row + fetch detail
  const handleToggle = useCallback(async (meetingId: string) => {
    if (expandedId === meetingId) { setExpandedId(null); return }
    setExpandedId(meetingId)
    if (!detailCache.has(meetingId)) {
      setLoadingDetail(meetingId)
      try {
        const res = await fetch(`/api/org-meetings/${meetingId}`)
        const data = await res.json()
        if (!data.error) setDetailCache((prev) => new Map(prev).set(meetingId, data))
      } catch { /* silent */ } finally { setLoadingDetail(null) }
    }
  }, [expandedId, detailCache])

  const updateMeeting = useCallback((id: string, patch: Partial<OrgMeeting>) => {
    setMeetings((prev) => prev.map((m) => m.id === id ? { ...m, ...patch } : m))
    // Invalidate detail cache so it refreshes on next expand
    setDetailCache((prev) => { const next = new Map(prev); next.delete(id); return next })
  }, [])

  // Filter + count
  const now = new Date()
  const filtered = meetings.filter((m) => {
    if (filter === 'upcoming') return new Date(m.start_time) > now
    if (filter === 'past') return new Date(m.start_time) <= now && !isFailed(m)
    if (filter === 'failed') return isFailed(m)
    return true
  })
  const counts: Record<FilterTab, number> = {
    all: meetings.length,
    upcoming: meetings.filter((m) => new Date(m.start_time) > now).length,
    past: meetings.filter((m) => new Date(m.start_time) <= now && !isFailed(m)).length,
    failed: meetings.filter(isFailed).length,
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--color-bg)]">
      <div className="max-w-3xl mx-auto px-8 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">Meetings</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {org?.name ?? 'Your workspace'} · Auto-recorded via Recall.ai
            </p>
          </div>
          <button
            onClick={syncAndRefresh} disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)] transition-colors disabled:opacity-60"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
        </div>

        <div className="space-y-4">
          {/* Calendar connection */}
          <CalendarBar calStatus={calStatus} onRefresh={() => fetchAll(true)} />

          {/* Upcoming meeting banner */}
          {!loading && <NextMeetingBanner meetings={meetings} />}

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse" />
              ))}
            </div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-[var(--color-border)] rounded-lg">
              <CalendarDays className="w-8 h-8 text-[var(--color-text-faint)] mx-auto mb-3" />
              <p className="text-sm font-medium text-[var(--color-text)]">No meetings discovered yet</p>
              <p className="text-xs text-[var(--color-text-faint)] mt-1 max-w-xs mx-auto">
                {calStatus?.connected
                  ? 'If you have upcoming Google Meet or Zoom events, hit Sync to discover them now.'
                  : 'Connect your Google Calendar above to get started.'}
              </p>
              {calStatus?.connected && (
                <button
                  onClick={syncAndRefresh} disabled={syncing}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] transition-colors"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
                  {syncing ? 'Syncing…' : 'Sync now'}
                </button>
              )}
            </div>
          ) : (
            <>
              <FilterTabs active={filter} onChange={setFilter} counts={counts} />

              {filtered.length === 0 ? (
                <p className="text-sm text-[var(--color-text-faint)] text-center py-8">No {filter} meetings</p>
              ) : (
                <div className="border border-[var(--color-border)] rounded-lg overflow-hidden divide-y divide-[var(--color-border)]">
                  {filtered.map((m) => (
                    <MeetingRow
                      key={m.id}
                      meeting={m}
                      expanded={expandedId === m.id}
                      onToggle={() => handleToggle(m.id)}
                      detail={loadingDetail === m.id ? null : (detailCache.get(m.id) ?? null)}
                      projects={projects}
                      onMeetingUpdate={updateMeeting}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
