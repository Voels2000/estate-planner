'use client'

import Link from 'next/link'
import { PlanningSurfaceNav } from '@/app/(dashboard)/_components/PlanningSurfaceNav'

type Action = { href: string; label: string }

type Props = {
  title: string
  description?: string
  actions?: Action[]
  icon?: string
}

export function PlanningProjectionEmptyState({
  title,
  description,
  actions = [],
  icon = '📊',
}: Props) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-6 flex justify-end">
        <PlanningSurfaceNav />
      </div>
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
        <div className="mb-3 text-4xl">{icon}</div>
        <p className="text-sm font-medium text-neutral-600">{title}</p>
        {description && <p className="mt-1 max-w-md text-xs text-neutral-500">{description}</p>}
        {actions.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="text-sm font-medium text-indigo-600 hover:underline"
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
