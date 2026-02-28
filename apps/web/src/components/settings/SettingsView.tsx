'use client'

import { useSettingsStore } from '@/stores/settings-store'
import { cn } from '@/lib/utils'

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

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--color-bg)]">
      <div className="max-w-2xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-text)] tracking-tight mb-1">
            Settings
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Preferences are saved locally to this browser.
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
        </div>
      </div>
    </div>
  )
}
