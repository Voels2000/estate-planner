import Link from 'next/link'
import type { ReactNode } from 'react'

export interface EmptyStateCardProps {
  message: string
  href: string
  linkLabel: string
  icon?: ReactNode
}

export function EmptyStateCard({ message, href, linkLabel, icon }: EmptyStateCardProps) {
  return (
    <section className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/80 px-5 py-6 text-center">
      {icon && <div className="mb-2 text-2xl">{icon}</div>}
      <p className="text-sm text-neutral-600">{message}</p>
      <Link
        href={href}
        className="mt-3 inline-block text-sm font-medium text-[color:var(--mwm-navy)] hover:text-[color:var(--mwm-navy)] hover:underline"
      >
        {linkLabel} →
      </Link>
    </section>
  )
}
