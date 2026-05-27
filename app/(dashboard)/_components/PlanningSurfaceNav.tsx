'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PLANNING_SURFACES } from '@/lib/planning/planningSurfaces'
import { planningSurfaceFromPathname } from '@/lib/planning/planningSurfaceFromPath'

type Props = {
  className?: string
}

export function PlanningSurfaceNav({ className = '' }: Props) {
  const pathname = usePathname()
  const current = planningSurfaceFromPathname(pathname ?? '')

  return (
    <nav
      className={`flex flex-wrap gap-2 ${className}`}
      aria-label="Related planning views"
    >
      {PLANNING_SURFACES.map((surface) => {
        const isCurrent = surface.id === current
        return (
          <Link
            key={surface.id}
            href={surface.href}
            aria-current={isCurrent ? 'page' : undefined}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              isCurrent
                ? 'border-[color:var(--mwm-navy)] bg-[color:var(--mwm-navy)] text-white'
                : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            {surface.shortLabel}
          </Link>
        )
      })}
    </nav>
  )
}
