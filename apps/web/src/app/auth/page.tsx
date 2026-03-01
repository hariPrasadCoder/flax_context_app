'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase'
import { toast } from 'sonner'
import { Zap, Mail, ArrowRight, KeyRound } from 'lucide-react'

function AuthPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const next = searchParams.get('next') ?? '/'
  const inviteToken = searchParams.get('invite')

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [loading, setLoading] = useState(false)
  const supabase = createSupabaseBrowser()

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    if (error) {
      toast.error(error.message)
    } else {
      setStep('code')
    }
    setLoading(false)
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.trim().length < 6) return
    setLoading(true)

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    // Check org membership to decide where to send the user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (inviteToken) {
      router.push(`/invite/${inviteToken}`)
    } else if (!membership) {
      router.push('/onboarding')
    } else {
      router.push(next)
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

        {step === 'email' ? (
          <>
            <h1
              className="text-2xl font-bold text-[var(--color-text)] mb-1"
              style={{ fontFamily: 'var(--font-merriweather)' }}
            >
              Welcome back
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-8">
              Enter your email to sign in or create an account
            </p>
            <form onSubmit={handleSendCode} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-faint)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  autoFocus
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
                    Send code
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1
              className="text-2xl font-bold text-[var(--color-text)] mb-1"
              style={{ fontFamily: 'var(--font-merriweather)' }}
            >
              Check your email
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-8">
              We sent a code to <strong>{email}</strong>
            </p>
            <form onSubmit={handleVerifyCode} className="space-y-3">
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-faint)]" />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6,8}"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="00000000"
                  required
                  autoFocus
                  className="w-full h-10 pl-9 pr-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:outline-none focus:border-[var(--color-accent)] transition-colors tracking-widest"
                />
              </div>
              <button
                type="submit"
                disabled={loading || code.trim().length < 6}
                className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 shadow-[var(--shadow-sm)]"
              >
                {loading ? (
                  <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <>
                    Verify code
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
            <button
              onClick={() => { setStep('email'); setCode('') }}
              className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors mt-4 block"
            >
              Use a different email
            </button>
          </>
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
