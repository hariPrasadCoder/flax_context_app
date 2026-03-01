'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase'
import { toast } from 'sonner'
import { Zap, Mail, ArrowRight, Check } from 'lucide-react'

function AuthPageContent() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/'
  const inviteToken = searchParams.get('invite')

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createSupabaseBrowser()

  const getRedirectTo = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return inviteToken
      ? `${origin}/auth/callback?invite=${inviteToken}`
      : `${origin}/auth/callback?next=${encodeURIComponent(next)}`
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: getRedirectTo() },
    })
    if (error) {
      toast.error(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
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
          Welcome back
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-8">
          Enter your email to sign in or create an account
        </p>

        {/* Magic link */}
        {sent ? (
          <div className="flex flex-col items-center text-center py-6 gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-success-subtle)]">
              <Check className="w-5 h-5 text-[var(--color-success)]" />
            </div>
            <p className="font-medium text-[var(--color-text)]">Check your email</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              We sent a magic link to <strong>{email}</strong>. Click it to sign in.
            </p>
            <button
              onClick={() => setSent(false)}
              className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors mt-1"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-faint)]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full h-10 pl-9 pr-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 shadow-[var(--shadow-sm)]"
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <>
                  Send magic link
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        <p className="text-xs text-[var(--color-text-faint)] text-center mt-8">
          By signing in you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthPageContent />
    </Suspense>
  )
}
