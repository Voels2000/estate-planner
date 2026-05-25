import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  /** Subtle hover lift for interactive tiles (e.g. links). */
  hover?: boolean
  /** Alias for `hover` — gold border + lift on hover */
  hoverable?: boolean
  /** Adds a top gold accent stripe */
  accent?: boolean
  onClick?: () => void
}

export function Card({
  children,
  className = '',
  hover = false,
  hoverable,
  accent = false,
  onClick,
}: CardProps) {
  const isHoverable = hoverable ?? hover

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white border border-[var(--mwm-border)]',
        'rounded-[var(--mwm-radius)] shadow-[var(--mwm-shadow)]',
        'transition-all duration-200',
        accent && 'border-t-[3px] border-t-[var(--mwm-gold)]',
        isHoverable &&
          'cursor-pointer hover:border-[var(--mwm-gold)] hover:shadow-[var(--mwm-shadow-lg)] hover:-translate-y-0.5',
        className,
      )}
    >
      {children}
    </div>
  )
}

Card.Body = function CardBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('p-6', className)}>{children}</div>
}

Card.Header = function CardHeader({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'px-6 py-4 border-b border-[var(--mwm-border)]',
        'font-[family-name:var(--font-display)] text-[var(--mwm-navy)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

Card.Footer = function CardFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'px-6 py-4 border-t border-[var(--mwm-border)]',
        'bg-[var(--mwm-off-white)] rounded-b-[var(--mwm-radius)]',
        className,
      )}
    >
      {children}
    </div>
  )
}
