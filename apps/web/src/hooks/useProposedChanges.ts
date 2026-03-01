'use client'

import { useState, useEffect, useCallback } from 'react'

export interface ProposedChange {
  id: string
  doc_id: string
  meeting_id: string
  block_id: string
  before_content: string | null
  after_content: string
  reason: string | null
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  meetings: { title: string; created_at: string } | null
}

export function useProposedChanges(docId: string) {
  const [changes, setChanges] = useState<ProposedChange[]>([])
  const [loading, setLoading] = useState(true)

  const fetchChanges = useCallback(() => {
    setLoading(true)
    fetch(`/api/proposed-changes?docId=${docId}&status=pending`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setChanges(data)
      })
      .finally(() => setLoading(false))
  }, [docId])

  useEffect(() => {
    fetchChanges()
  }, [fetchChanges])

  const resolveChange = useCallback(
    async (changeId: string, action: 'accept' | 'reject') => {
      const res = await fetch(`/api/proposed-changes/${changeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        // Remove resolved change from local state
        setChanges((prev) => prev.filter((c) => c.id !== changeId))
      }
      return res.ok
    },
    []
  )

  const acceptAll = useCallback(async () => {
    await Promise.all(changes.map((c) => resolveChange(c.id, 'accept')))
  }, [changes, resolveChange])

  return {
    changes,
    loading,
    pendingCount: changes.length,
    resolveChange,
    acceptAll,
    refetch: fetchChanges,
  }
}
