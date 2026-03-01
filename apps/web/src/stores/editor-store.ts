'use client'

import { create } from 'zustand'

interface EditorStore {
  // History panel
  historyPanelOpen: boolean
  activeBlockId: string | null
  openHistoryPanel: (blockId?: string) => void
  closeHistoryPanel: () => void

  // Proposals panel
  proposalsPanelOpen: boolean
  openProposalsPanel: () => void
  closeProposalsPanel: () => void

  // Sidebar
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const useEditorStore = create<EditorStore>((set) => ({
  historyPanelOpen: false,
  activeBlockId: null,

  openHistoryPanel: (blockId) =>
    set({ historyPanelOpen: true, proposalsPanelOpen: false, activeBlockId: blockId ?? null }),

  closeHistoryPanel: () =>
    set({ historyPanelOpen: false, activeBlockId: null }),

  proposalsPanelOpen: false,

  openProposalsPanel: () =>
    set({ proposalsPanelOpen: true, historyPanelOpen: false, activeBlockId: null }),

  closeProposalsPanel: () =>
    set({ proposalsPanelOpen: false }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))
