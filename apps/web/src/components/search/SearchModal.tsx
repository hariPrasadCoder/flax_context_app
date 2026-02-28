'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FileText, Loader2, X } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

interface SearchResult {
  id: string
  title: string
  project_id: string
  updated_at: string
  projects: { id: string; name: string; emoji: string; color: string } | null
}

interface SearchModalProps {
  open: boolean
  onClose: () => void
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounced search
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim() || q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResults(Array.isArray(data) ? data : [])
        setSelected(0)
      } finally {
        setLoading(false)
      }
    }, 200)
  }, [])

  useEffect(() => {
    search(query)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  const navigate = useCallback(
    (docId: string) => {
      router.push(`/docs/${docId}`)
      onClose()
    },
    [router, onClose]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) { navigate(results[selected].id) }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--color-border)]">
          {loading ? (
            <Loader2 className="w-4 h-4 text-[var(--color-text-faint)] shrink-0 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-[var(--color-text-faint)] shrink-0" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search documents…"
            className="flex-1 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ul className="py-2 max-h-80 overflow-y-auto">
            {results.map((doc, i) => (
              <li key={doc.id}>
                <button
                  onClick={() => navigate(doc.id)}
                  onMouseEnter={() => setSelected(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    selected === i ? 'bg-[var(--color-sidebar-hover)]' : ''
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ backgroundColor: doc.projects ? `${doc.projects.color}18` : undefined }}
                  >
                    {doc.projects?.emoji ?? <FileText className="w-3.5 h-3.5 text-[var(--color-text-faint)]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">{doc.title}</p>
                    <p className="text-xs text-[var(--color-text-faint)]">
                      {doc.projects?.name} · {formatRelativeTime(new Date(doc.updated_at))}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Empty states */}
        {query.length >= 2 && !loading && results.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">No documents matching "{query}"</p>
          </div>
        )}

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-[var(--color-border)] bg-[var(--color-sidebar)]">
          <span className="text-[10px] text-[var(--color-text-faint)]">↑↓ navigate</span>
          <span className="text-[10px] text-[var(--color-text-faint)]">↵ open</span>
          <span className="text-[10px] text-[var(--color-text-faint)]">esc close</span>
        </div>
      </div>
    </div>
  )
}
