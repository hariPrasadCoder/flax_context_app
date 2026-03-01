'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { SearchModal } from '@/components/search/SearchModal'
import { useSettingsStore } from '@/stores/settings-store'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const theme = useSettingsStore((s) => s.theme)

  // Apply/remove dark class on <html> whenever theme changes
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      <Sidebar onSearch={() => setSearchOpen(true)} />
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {children}
      </main>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
