'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSettingsStore } from '@/stores/settings-store'

interface DocumentData {
  id: string
  title: string
  content: unknown
  project_id: string
  updated_at: string
  status: 'draft' | 'published'
}

export function useDocument(docId: string) {
  const [doc, setDoc] = useState<DocumentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSaveDelay = useSettingsStore((s) => s.autoSaveDelay)

  useEffect(() => {
    fetch(`/api/documents/${docId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setDoc(data)
      })
      .catch(() => setError('Failed to load document'))
      .finally(() => setLoading(false))
  }, [docId])

  const saveContent = useCallback(
    (content: unknown) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true)
        try {
          const res = await fetch(`/api/documents/${docId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
          })
          const data = await res.json()
          if (!data.error) setDoc((d) => d ? { ...d, ...data } : d)
        } finally {
          setSaving(false)
        }
      }, autoSaveDelay)
    },
    [docId, autoSaveDelay]
  )

  const saveTitle = useCallback(
    async (title: string) => {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      const data = await res.json()
      if (!data.error) setDoc((d) => d ? { ...d, title } : d)
    },
    [docId]
  )

  const publishDoc = useCallback(async () => {
    const res = await fetch(`/api/documents/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published' }),
    })
    const data = await res.json()
    if (!data.error) setDoc((d) => d ? { ...d, status: 'published' } : d)
  }, [docId])

  return { doc, loading, error, saving, saveContent, saveTitle, publishDoc }
}
