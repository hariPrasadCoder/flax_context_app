'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSettingsStore } from '@/stores/settings-store'

interface DocumentRow {
  id: string
  title: string
  parent_id: string | null
  updated_at: string
  created_at: string
}

interface ProjectRow {
  id: string
  name: string
  description: string | null
  emoji: string
  color: string
  created_at: string
  updated_at: string
  documents: DocumentRow[]
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const defaultDocStatus = useSettingsStore((s) => s.defaultDocStatus)

  const fetchProjects = useCallback(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProjects(data)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const createProject = useCallback(
    async (data: { name: string; description?: string; emoji?: string; color?: string }) => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const project = await res.json()
      if (!project.error) {
        fetchProjects()
      }
      return project
    },
    [fetchProjects]
  )

  const createDocument = useCallback(
    async (projectId: string, title = 'Untitled') => {
      const res = await fetch(`/api/projects/${projectId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, status: defaultDocStatus }),
      })
      const doc = await res.json()
      if (!doc.error) {
        fetchProjects()
        router.push(`/docs/${doc.id}`)
      }
      return doc
    },
    [fetchProjects, router]
  )

  const deleteProject = useCallback(
    async (projectId: string) => {
      await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
      fetchProjects()
    },
    [fetchProjects]
  )

  const deleteDocument = useCallback(
    async (docId: string) => {
      await fetch(`/api/documents/${docId}`, { method: 'DELETE' })
      fetchProjects()
    },
    [fetchProjects]
  )

  return { projects, loading, createProject, createDocument, deleteProject, deleteDocument, refetch: fetchProjects }
}
