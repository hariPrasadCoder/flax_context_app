'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

export interface BlockHistoryEntry {
  id: string
  block_id: string
  doc_id: string
  before_content: string | null
  after_content: string
  source: 'manual' | 'meeting' | 'ai'
  author_name: string | null
  author_color: string | null
  meeting_id: string | null
  meeting_title: string | null
  reason: string | null
  created_at: string
}

export function useBlockHistory(docId: string) {
  const [history, setHistory] = useState<BlockHistoryEntry[]>([])

  const fetchHistory = useCallback(() => {
    fetch(`/api/block-history/${docId}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setHistory(data) })
  }, [docId])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const addEntry = useCallback(
    async (entry: {
      blockId: string
      beforeContent?: string | null
      afterContent: string
      source?: 'manual' | 'meeting' | 'ai'
      authorName?: string
      authorColor?: string
      reason?: string
    }) => {
      const res = await fetch(`/api/block-history/${docId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })
      const data = await res.json()
      if (!data.error) setHistory((prev) => [...prev, data])
      return data
    },
    [docId]
  )

  // Map of blockId → sorted history entries (oldest first)
  const historyByBlock = useMemo(() => {
    const map = new Map<string, BlockHistoryEntry[]>()
    for (const entry of history) {
      const list = map.get(entry.block_id) ?? []
      list.push(entry)
      map.set(entry.block_id, list)
    }
    // Sort each list oldest → newest
    map.forEach((list) => list.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ))
    return map
  }, [history])

  const changedBlockIds = useMemo(
    () => new Set(history.map((h) => h.block_id)),
    [history]
  )

  return { history, addEntry, historyByBlock, changedBlockIds, refetch: fetchHistory }
}
