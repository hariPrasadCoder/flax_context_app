'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { SearchModal } from '@/components/search/SearchModal'
import { useSettingsStore } from '@/stores/settings-store'
import { cn } from '@/lib/utils'
import { Menu, Zap } from 'lucide-react'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const theme = useSettingsStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setMobileSidebarOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar — off-canvas on mobile, inline on desktop */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-30',
          'md:relative md:inset-auto md:z-auto md:flex-none',
          'transition-transform duration-200 ease-in-out md:transition-none',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <Sidebar
          onSearch={() => { setSearchOpen(true); setMobileSidebarOpen(false) }}
          collapsed={collapsed}
          onCollapse={() => setCollapsed((v) => !v)}
          onClose={() => setMobileSidebarOpen(false)}
        />
      </div>

      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* Mobile-only top bar with hamburger */}
        <div className="flex items-center gap-3 h-13 px-4 border-b border-[var(--color-border)] bg-[var(--color-sidebar)] md:hidden shrink-0">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-[var(--color-sidebar-hover)] text-[var(--color-text-muted)] transition-colors"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[var(--color-accent)] text-white">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-[var(--color-text)] tracking-tight text-sm">Flax</span>
          </div>
        </div>

        {children}
      </main>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
