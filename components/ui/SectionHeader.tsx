import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function SectionHeader({
  title,
  subtitle,
  action,
  accent = false,
  as = 'h2',
  className = '',
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  accent?: boolean
  as?: 'h1' | 'h2'
  className?: string
}) {
  const Heading = as === 'h1' ? 'h1' : 'h2'

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4',
        accent && 'pl-4 border-l-[3px] border-[var(--mwm-gold)]',
        className,
      )}
    >
      <div>
        <Heading className="font-[family-name:var(--font-display)] text-2xl font-medium text-[var(--mwm-navy)] leading-snug">
          {title}
        </Heading>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--mwm-text-secondary)] leading-relaxed">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0 mt-0.5">{action}</div>}
    </div>
  )
}
