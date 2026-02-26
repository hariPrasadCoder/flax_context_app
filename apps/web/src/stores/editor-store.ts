'use client'

import { create } from 'zustand'

interface EditorStore {
  // History panel
  historyPanelOpen: boolean
  activeBlockId: string | null   // block whose history we're viewing
  openHistoryPanel: (blockId?: string) => void
  closeHistoryPanel: () => void

  // Sidebar
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const useEditorStore = create<EditorStore>((set) => ({
  historyPanelOpen: false,
  activeBlockId: null,

  openHistoryPanel: (blockId) =>
    set({ historyPanelOpen: true, activeBlockId: blockId ?? null }),

  closeHistoryPanel: () =>
    set({ historyPanelOpen: false, activeBlockId: null }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))
