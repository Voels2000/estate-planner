'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { FEATURE_TIERS, TIER_NAMES } from '@/lib/tiers'

type NavItem = {
  href: string
  label: string
  icon: string
  feature?: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',   label: 'Dashboard',                           icon: '📊', feature: 'dashboard' },
  { href: '/profile',     label: 'Profile',                             icon: '👤', feature: 'profile' },
  { href: '/assets',      label: 'Assets',                              icon: '🏦', feature: 'assets' },
  { href: '/liabilities', label: 'Liabilities',                         icon: '💳', feature: 'liabilities' },
  { href: '/income',      label: 'Income',                              icon: '💰', feature: 'income' },
  { href: '/expenses',    label: 'Expenses',                            icon: '💸', feature: 'expenses' },
  { href: '/projections', label: 'Projections',                         icon: '📈', feature: 'projections' },
  { href: '/scenarios',   label: 'Scenarios',                           icon: '🔮', feature: 'scenarios' },
  { href: '/allocation',  label: 'Asset Allocation',                  icon: '📐', feature: 'allocation' },
  { href: '/complete',    label: 'Lifetime Financial & Estate Snapshot', icon: '📊', feature: 'complete' },
  { href: '/rmd',         label: 'RMD Calculator',                      icon: '📋', feature: 'rmd' },
  { href: '/roth',        label: 'Roth Conversion Strategy',            icon: '🔄', feature: 'roth' },
  { href: '/real-estate', label: 'Real Estate',                         icon: '🏠', feature: 'real-estate' },
  { href: '/insurance',   label: 'Insurance Gap Analysis',              icon: '🛡️', feature: 'insurance' },
  { href: '/monte-carlo', label: 'Monte Carlo Simulations',              icon: '📊', feature: 'monte-carlo' },
  { href: '/social-security', label: 'Social Security Report',               icon: '🏛️', feature: 'social-security' },

  { href: '/import',      label: 'Import Data',                         icon: '📥', feature: 'import' },
  { href: '/titling',     label: 'Titling & Beneficiaries',             icon: '📜', feature: 'titling' },
  { href: '/estate-tax',  label: 'Estate Tax',                          icon: '⚖️', feature: 'estate-tax' },
  { href: '/incapacity',  label: 'Incapacity Planning',                 icon: '🏥', feature: 'incapacity' },
  { href: '/gifting',    label: 'Gifting Strategy',                     icon: '🎁', feature: 'gifting' },
  { href: '/charitable', label: 'Charitable Giving', icon: '🤝', feature: 'charitable' },
  { href: '/business-succession', label: 'Business Succession', icon: '🏢', feature: 'business-succession' },
  { href: '/billing',     label: 'Billing',             icon: '💳' },
]

export function SidebarNav({
  user,
  role,
  tier = 1,
  isAdvisor = false,
}: {
  user: User
  role?: string
  tier?: number
  isAdvisor?: boolean
}) {
  const pathname = usePathname()
  const [activePath, setActivePath] = useState('')
  useEffect(() => { setActivePath(pathname) }, [pathname])
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isLocked(feature?: string): boolean {
    if (!feature) return false
    if (isAdvisor) return false
    const required = FEATURE_TIERS[feature] ?? 1
    return tier < required
  }

  function lockLabel(feature?: string): string {
    if (!feature) return ''
    const required = FEATURE_TIERS[feature] ?? 1
    return TIER_NAMES[required as 1|2|3]
  }

  return (
    <aside className="w-64 shrink-0 border-r border-neutral-200 bg-white flex flex-col">
      <div className="px-6 py-5 border-b border-neutral-200">
        <h1 className="text-lg font-bold text-neutral-900">Estate Planner</h1>
      <p className="text-xs text-neutral-500 mt-0.5 truncate">{user.email}</p>
        {!isAdvisor && (
          <span className="mt-1.5 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
            {TIER_NAMES[tier as 1|2|3] ?? 'Starter'} Plan
          </span>
        )}
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = activePath === item.href
          const locked = isLocked(item.feature)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-neutral-900 text-white'
                  : locked
                    ? 'text-neutral-400 hover:bg-neutral-50'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="flex-1 truncate">{item.label}</span>
              {locked && (
                <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-1 py-0 text-[10px] font-medium text-amber-700">
                  🔒 {lockLabel(item.feature)}
                </span>
              )}
            </Link>
          )
        })}
        {role === 'advisor' && (
          <Link
            href="/advisor"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activePath === '/advisor' || activePath.startsWith('/advisor/')
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            <span className="text-base">💼</span>
            Advisor Portal
          </Link>
        )}
        {role === 'admin' && (
          <Link
            href="/admin"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activePath === '/admin'
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            <span className="text-base">⚙️</span>
            Admin Portal
          </Link>
        )}
      </nav>
      <div className="px-3 py-4 border-t border-neutral-200">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
        >
          <span className="text-base">🚪</span>
          Sign out
        </button>
      </div>
    </aside>
  )
}

