'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  // Profile — used for block history attribution
  authorName: string
  authorColor: string
  // Appearance
  theme: 'light' | 'dark'
  // Editor
  defaultDocStatus: 'draft' | 'published'
  autoSaveDelay: 400 | 800 | 2000
  // AI
  aiModel: 'claude-haiku-4-5-20251001' | 'claude-sonnet-4-6'
  // Updater
  update: (patch: Partial<Omit<SettingsState, 'update'>>) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      authorName: 'You',
      authorColor: '#2563EB',
      theme: 'light',
      defaultDocStatus: 'draft',
      autoSaveDelay: 800,
      aiModel: 'claude-sonnet-4-6',
      update: (patch) => set(patch),
    }),
    { name: 'flax-settings' }
  )
)
