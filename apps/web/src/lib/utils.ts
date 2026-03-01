import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true })
}

export function formatDate(date: Date): string {
  return format(date, 'MMM d, yyyy')
}

export function formatDateTime(date: Date): string {
  return format(date, 'MMM d, yyyy · h:mm a')
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Extracts plain text from TipTap content for history preview
export function extractTextFromNode(node: object | string | null | undefined): string {
  if (!node) return ''
  if (typeof node === 'string') return node
  const n = node as Record<string, unknown>
  if (n.text) return n.text as string
  if (n.content && Array.isArray(n.content)) {
    return (n.content as object[]).map(extractTextFromNode).join('')
  }
  return ''
}
