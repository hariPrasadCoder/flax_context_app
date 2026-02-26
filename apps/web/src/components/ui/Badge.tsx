import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'accent' | 'changed' | 'success' | 'ghost' | 'danger'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    default:
      'bg-[var(--color-border)] text-[var(--color-text-muted)]',
    accent:
      'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]',
    changed:
      'bg-[var(--color-changed-subtle)] text-[var(--color-changed)]',
    success:
      'bg-green-50 text-green-700',
    ghost:
      'bg-transparent text-[var(--color-text-faint)] border border-[var(--color-border)]',
    danger:
      'bg-red-50 text-red-600',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
