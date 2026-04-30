import type { ReactNode } from 'react'

export function SectionHeader({
  title,
  subtitle,
  right,
  as = 'h2',
}: {
  title: string
  subtitle?: string
  right?: ReactNode
  as?: 'h1' | 'h2'
}) {
  const Heading = as === 'h1' ? 'h1' : 'h2'
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Heading className="text-2xl font-semibold text-neutral-900">{title}</Heading>
        {subtitle && <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

