import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
  hover = false,
}: {
  children: ReactNode
  className?: string
  /** Subtle hover lift for interactive tiles (e.g. links). */
  hover?: boolean
}) {
  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white shadow-sm ${
        hover ? 'transition hover:border-neutral-300 hover:shadow-md' : ''
      } ${className}`.trim()}
    >
      {children}
    </div>
  )
}

