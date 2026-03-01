'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase'
import { toast } from 'sonner'
import { Zap, ArrowRight } from 'lucide-react'

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowser()

  const [displayName, setDisplayName] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [loading, setLoading] = useState(false)

  // Pre-fill display name from Google metadata
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.full_name) {
        setDisplayName(user.user_metadata.full_name)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-derive slug from workspace name unless user has edited it manually
  useEffect(() => {
    if (!slugEdited) {
      setSlug(toSlug(workspaceName))
    }
  }, [workspaceName, slugEdited])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspaceName.trim() || !slug.trim() || !displayName.trim()) return
    setLoading(true)

    try {
      const res = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workspaceName.trim(),
          slug: slug.trim(),
          displayName: displayName.trim(),
        }),
      })

      // Guard against non-JSON responses (e.g. middleware redirect to HTML)
      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        toast.error(`Server error (${res.status}). Check that you're signed in.`)
        return
      }

      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        router.push('/')
        router.refresh()
      }
    } catch (err) {
      console.error('[onboarding] create workspace error:', err)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-10">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-accent)] text-white">
            <Zap className="w-4 h-4" />
          </div>
          <span className="font-semibold text-lg text-[var(--color-text)] tracking-tight">Flax</span>
        </div>

        <h1
          className="text-2xl font-bold text-[var(--color-text)] mb-1"
          style={{ fontFamily: 'var(--font-merriweather)' }}
        >
          Create your workspace
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-8">
          Set up your team's home on Flax
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Display name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
              Your name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Hari Kumar"
              required
              className="w-full h-10 px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          {/* Workspace name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
              Workspace name
            </label>
            <input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Acme Inc"
              required
              className="w-full h-10 px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
              Workspace URL
            </label>
            <div className="flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden focus-within:border-[var(--color-accent)] transition-colors">
              <span className="px-3 h-10 flex items-center text-sm text-[var(--color-text-faint)] border-r border-[var(--color-border)] bg-[var(--color-sidebar)] shrink-0">
                joinflax.com/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(toSlug(e.target.value))
                  setSlugEdited(true)
                }}
                placeholder="acme-inc"
                required
                className="flex-1 h-10 px-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] bg-transparent focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !workspaceName.trim() || !slug.trim() || !displayName.trim()}
            className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 shadow-[var(--shadow-sm)] mt-2"
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <>
                Create workspace
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
