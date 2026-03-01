'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface OrgInfo {
  id: string
  name: string
  slug: string
  logo_url: string | null
}

interface MemberInfo {
  role: 'owner' | 'admin' | 'member'
  display_name: string | null
  avatar_url: string | null
}

interface AuthContextValue {
  user: User | null
  org: OrgInfo | null
  member: MemberInfo | null
  loading: boolean
  signOut: () => Promise<void>
  refreshOrg: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  org: null,
  member: null,
  loading: true,
  signOut: async () => {},
  refreshOrg: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [member, setMember] = useState<MemberInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createSupabaseBrowser()

  const fetchOrg = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from('organization_members')
        .select('role, display_name, avatar_url, organizations(id, name, slug, logo_url)')
        .eq('user_id', userId)
        .maybeSingle()

      if (data) {
        setOrg(data.organizations as unknown as OrgInfo)
        setMember({
          role: data.role as MemberInfo['role'],
          display_name: data.display_name,
          avatar_url: data.avatar_url,
        })
      } else {
        // Authenticated but no org → needs onboarding
        setOrg(null)
        setMember(null)
        // Only redirect if not already on the onboarding or invite pages
        const path = window.location.pathname
        if (!path.startsWith('/onboarding') && !path.startsWith('/invite')) {
          router.push('/onboarding')
        }
      }
    },
    [supabase, router]
  )

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        fetchOrg(u.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        fetchOrg(u.id)
      } else {
        setOrg(null)
        setMember(null)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setOrg(null)
    setMember(null)
    router.push('/auth')
  }, [supabase, router])

  const refreshOrg = useCallback(async () => {
    if (user) await fetchOrg(user.id)
  }, [user, fetchOrg])

  return (
    <AuthContext.Provider value={{ user, org, member, loading, signOut, refreshOrg }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
