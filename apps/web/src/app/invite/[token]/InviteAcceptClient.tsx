'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Zap, Users } from 'lucide-react'

interface Props {
  token: string
  orgName: string
  role: string
  isLoggedIn: boolean
  userEmail?: string
  inviteEmail?: string | null
}

export function InviteAcceptClient({
  token,
  orgName,
  role,
  isLoggedIn,
  userEmail,
  inviteEmail,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleAccept = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/invitations/${token}/accept`, { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success(`You've joined ${orgName}!`)
        router.push('/')
        router.refresh()
      }
    } catch {
      toast.error('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = () => {
    router.push(`/auth?invite=${token}`)
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

        {/* Invite card */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 shadow-[var(--shadow-md)] mb-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-[var(--color-accent-subtle)] mb-4">
            <Users className="w-6 h-6 text-[var(--color-accent)]" />
          </div>
          <h1
            className="text-xl font-bold text-[var(--color-text)] mb-1"
            style={{ fontFamily: 'var(--font-merriweather)' }}
          >
            You've been invited
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-1">
            Join <strong className="text-[var(--color-text)]">{orgName}</strong> on Flax
          </p>
          <p className="text-xs text-[var(--color-text-faint)]">
            You'll join as a <span className="font-medium">{role}</span>
            {inviteEmail && ` · for ${inviteEmail}`}
          </p>
        </div>

        {isLoggedIn ? (
          <div className="space-y-3">
            {userEmail && (
              <p className="text-xs text-center text-[var(--color-text-faint)]">
                Signing in as <strong>{userEmail}</strong>
              </p>
            )}
            <button
              onClick={handleAccept}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 shadow-[var(--shadow-sm)]"
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                `Join ${orgName}`
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handleSignIn}
              className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-[var(--shadow-sm)]"
            >
              Sign in to accept
            </button>
            <p className="text-xs text-center text-[var(--color-text-faint)]">
              Don't have an account? You'll create one during sign in.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
