'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type AdvisorTabsProps = {
  showFirmSettingsTab: boolean
}

export function AdvisorTabs({ showFirmSettingsTab }: AdvisorTabsProps) {
  const pathname = usePathname()
  const clientsActive = pathname === '/advisor' || pathname === '/advisor/'
  const firmActive =
    pathname === '/advisor/firm' || pathname.startsWith('/advisor/firm/')
  const analyticsActive =
    pathname === '/advisor/analytics' || pathname.startsWith('/advisor/analytics')
  const prospectActive =
    pathname === '/advisor/prospect' || pathname.startsWith('/advisor/prospect')

  const tabClass = (active: boolean) =>
    [
      'inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm font-medium -mb-px transition-colors',
      active
        ? 'border-indigo-600 text-indigo-700'
        : 'border-transparent text-neutral-600 hover:border-neutral-300 hover:text-neutral-900',
    ].join(' ')

  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-neutral-200"
      aria-label="Advisor sections"
    >
      <Link href="/advisor" className={tabClass(clientsActive)}>
        👥 My Clients
      </Link>
      {showFirmSettingsTab && (
        <Link href="/advisor/firm" className={tabClass(firmActive)}>
          ⚙️ Firm Settings
        </Link>
      )}
      <Link href="/advisor/analytics" className={tabClass(analyticsActive)}>
        📊 Analytics
      </Link>
      <Link href="/advisor/prospect" className={tabClass(prospectActive)}>
        🔍 Prospect Mode
      </Link>
    </nav>
  )
}
