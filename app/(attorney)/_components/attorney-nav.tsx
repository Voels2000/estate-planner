'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/attorney', label: 'Clients', match: (p: string) => p === '/attorney' },
  {
    href: '/attorney/requests',
    label: 'Requests',
    match: (p: string) => p.startsWith('/attorney/requests'),
  },
  {
    href: '/attorney/billing',
    label: 'Billing',
    match: (p: string) => p.startsWith('/attorney/billing'),
  },
  {
    href: '/attorney/settings',
    label: 'Firm settings',
    match: (p: string) => p.startsWith('/attorney/settings'),
  },
] as const

export function AttorneyNav({ pendingRequestCount = 0 }: { pendingRequestCount?: number }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-white px-6">
      {LINKS.map((link) => {
        const active = link.match(pathname)
        const badge = link.href === '/attorney/requests' && pendingRequestCount > 0
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`relative px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {link.label}
            {badge && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                {pendingRequestCount}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
