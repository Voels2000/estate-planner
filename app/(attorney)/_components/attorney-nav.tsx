'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/attorney', label: 'Clients', match: (p: string) => p === '/attorney' || p.startsWith('/attorney/clients') },
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
    href: '/attorney/marketing',
    label: 'Marketing',
    match: (p: string) => p.startsWith('/attorney/marketing'),
  },
  {
    href: '/attorney/settings',
    label: 'Firm settings',
    match: (p: string) => p.startsWith('/attorney/settings'),
  },
] as const

export function AttorneyNav({ pendingRequestCount = 0 }: { pendingRequestCount?: number }) {
  const pathname = usePathname()

  const tabClass = (active: boolean) =>
    [
      'relative inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm font-medium -mb-px transition-colors',
      active
        ? 'border-[color:var(--mwm-gold)] text-[color:var(--mwm-navy)]'
        : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-[color:var(--mwm-navy)]',
    ].join(' ')

  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-neutral-200"
      aria-label="Attorney sections"
    >
      {LINKS.map((link) => {
        const active = link.match(pathname)
        const badge = link.href === '/attorney/requests' && pendingRequestCount > 0
        return (
          <Link key={link.href} href={link.href} className={tabClass(active)}>
            {link.label}
            {badge && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--mwm-gold)] px-1.5 text-[10px] font-bold text-[color:var(--mwm-navy)]">
                {pendingRequestCount}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
