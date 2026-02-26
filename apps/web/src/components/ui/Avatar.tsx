'use client'

import { cn, getInitials } from '@/lib/utils'
import { User } from '@/lib/types'

interface AvatarProps {
  user: User
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showTooltip?: boolean
}

export function Avatar({ user, size = 'md', className, showTooltip }: AvatarProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  }

  return (
    <div className="relative group" title={showTooltip ? user.name : undefined}>
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-semibold text-white shrink-0 select-none',
          sizeClasses[size],
          className
        )}
        style={{ backgroundColor: user.color }}
      >
        {getInitials(user.name)}
      </div>
    </div>
  )
}

interface AvatarGroupProps {
  users: User[]
  max?: number
  size?: 'sm' | 'md'
}

export function AvatarGroup({ users, max = 3, size = 'sm' }: AvatarGroupProps) {
  const visible = users.slice(0, max)
  const overflow = users.length - max

  return (
    <div className="flex items-center">
      {visible.map((user, i) => (
        <div
          key={user.id}
          className={cn('relative ring-2 ring-[var(--color-surface)] rounded-full', i > 0 && '-ml-2')}
          title={user.name}
        >
          <Avatar user={user} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            '-ml-2 rounded-full ring-2 ring-[var(--color-surface)] flex items-center justify-center bg-[var(--color-border)] text-[var(--color-text-muted)] font-medium',
            size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
