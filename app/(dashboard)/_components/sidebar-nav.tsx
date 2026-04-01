'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { FEATURE_TIERS, TIER_NAMES } from '@/lib/tiers'
import { NotificationBell } from './notification-bell'

type NavItem = {
  href: string
  label: string
  icon: string
  feature?: string
  advisorOnly?: boolean
  consumerOnly?: boolean
  minTier?: number          // optional minimum consumer tier (1|2|3)
}

type NavGroup = {
  label: string
  icon: string
  items: NavItem[]
  locked?: boolean
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    icon: '🏠',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: '📊', feature: 'dashboard' },
      { href: '/profile', label: 'Profile', icon: '👤', feature: 'profile' },
      { href: '/settings/security', label: 'Security', icon: '🔐', feature: 'profile' },
    ],
  },
  {
    label: 'Financial Planning',
    icon: '💰',
    items: [
      { href: '/assets', label: 'Assets', icon: '🏦', feature: 'assets' },
      { href: '/liabilities', label: 'Liabilities', icon: '💳', feature: 'liabilities' },
      { href: '/income', label: 'Income', icon: '💰', feature: 'income' },
      { href: '/expenses', label: 'Expenses', icon: '💸', feature: 'expenses' },
      { href: '/projections', label: 'Projections', icon: '📈', feature: 'projections' },
      { href: '/allocation', label: 'Asset Allocation', icon: '📐', feature: 'allocation' },
      { href: '/real-estate', label: 'Real Estate', icon: '🏠', feature: 'real-estate' },
      { href: '/scenarios', label: 'Scenarios', icon: '🔮', feature: 'scenarios' },
      { href: '/insurance', label: 'Insurance Gap Analysis', icon: '🛡️', feature: 'insurance' },
    ],
  },
  {
    label: 'Retirement Planning',
    icon: '🏖️',
    locked: true,
    items: [
      { href: '/social-security', label: 'Social Security', icon: '🏛️', feature: 'social-security' },
      { href: '/complete', label: 'Lifetime Snapshot', icon: '📊', feature: 'complete' },
      { href: '/rmd', label: 'RMD Calculator', icon: '📋', feature: 'rmd' },
      { href: '/roth', label: 'Roth Conversion', icon: '🔄', feature: 'roth' },
      { href: '/monte-carlo', label: 'Monte Carlo', icon: '📊', feature: 'monte-carlo' },
    ],
  },
  {
    label: 'Estate Planning',
    icon: '📜',
    locked: true,
    items: [
      { href: '/titling', label: 'Titling & Beneficiaries', icon: '📜', feature: 'titling' },
      { href: '/domicile-analysis', label: 'Domicile Analysis', icon: '🗺️', feature: 'domicile-analysis' },
      { href: '/incapacity', label: 'Incapacity Planning', icon: '🏥', feature: 'incapacity' },
      { href: '/estate-tax', label: 'Estate Tax', icon: '⚖️', feature: 'estate-tax', advisorOnly: true },
      { href: '/gifting', label: 'Gifting Strategy', icon: '🎁', feature: 'gifting', advisorOnly: true },
      { href: '/charitable', label: 'Charitable Giving', icon: '🤝', feature: 'charitable', advisorOnly: true },
      { href: '/business-succession', label: 'Business Succession', icon: '🏢', feature: 'business-succession', advisorOnly: true },
      { href: '/trust-will', label: 'Trust & Will Guidance', icon: '📋', minTier: 3 },
      { href: '/print', label: 'Export Estate Plan', icon: '📄', minTier: 3 },
    ],
  },
  {
    label: 'Resources',
    icon: '📚',
    items: [
      { href: '/advisor-directory', label: 'Find an Advisor', icon: '🔍' },
      { href: '/attorney-directory', label: 'Find an Attorney', icon: '⚖️' },
      { href: '/referrals', label: 'Attorney Referrals', icon: '📝', consumerOnly: true },
      { href: '/my-advisor', label: 'My Advisor', icon: '👤', consumerOnly: true },
      { href: '/list-your-practice', label: 'List Your Practice', icon: '📋', advisorOnly: true },
      { href: '/import', label: 'Import Data', icon: '📥', feature: 'import' },
      { href: '/print', label: 'Export Estate Plan', icon: '📄', advisorOnly: true },
    ],
  },
]

export function SidebarNav({
  user,
  role,
  tier = 1,
  isAdvisor = false,
  isAdmin = false,
  isAttorney = false,
}: {
  user: User
  role?: string
  tier?: number
  isAdvisor?: boolean
  isAdmin?: boolean
  isAttorney?: boolean
}) {
  const pathname = usePathname()
  const [activePath, setActivePath] = useState('')
  const router = useRouter()

  function getActiveGroup(): string {
    for (const group of NAV_GROUPS) {
      if (group.items.some(item => item.href === pathname)) return group.label
    }
    return 'Overview'
  }

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setActivePath(pathname)
    const activeGroup = getActiveGroup()
    setOpenGroups(prev => ({ ...prev, [activeGroup]: true }))
  }, [pathname])

  function toggleGroup(label: string) {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

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
    return TIER_NAMES[required as 1 | 2 | 3]
  }

  return (
    <aside className="w-64 shrink-0 border-r border-neutral-200 bg-white flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-neutral-200">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-neutral-900">Estate Planner</h1>
            <p className="text-xs text-neutral-500 mt-0.5 truncate">{user.email}</p>
            {!isAdvisor && (
              <span className="mt-1.5 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                {TIER_NAMES[tier as 1 | 2 | 3] ?? 'Starter'} Plan
              </span>
            )}
          </div>
          <NotificationBell />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          const isOpen = openGroups[group.label] ?? false
          const hasActive = group.items.some(item => item.href === activePath)
          const groupIsLocked = group.locked === true && !isAdvisor && (
            (group.label === 'Retirement Planning' && tier < 2) ||
            (group.label === 'Estate Planning' && tier < 3)
          )

          return (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  hasActive
                    ? 'text-neutral-900 bg-neutral-50'
                    : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <span className="flex-1 text-left">{group.label}</span>
                {groupIsLocked && (
                  <span className="text-amber-400 text-sm mr-1">🔒</span>
                )}
                <span className="text-neutral-400">{isOpen ? '▾' : '▸'}</span>
              </button>

              {isOpen && (
                <div className="mt-1 ml-2 space-y-0.5">
                  {groupIsLocked && (
                    <div className="px-3 py-1.5 text-[11px] text-amber-700 bg-amber-50 rounded-lg mb-1">
                      {group.label === 'Retirement Planning' ? (
                        <span>{`Upgrade to the ${TIER_NAMES[2]} plan to unlock`}</span>
                      ) : tier < 2 ? (
                        <span>{`Upgrade to the ${TIER_NAMES[2]} plan first`}</span>
                      ) : (
                        <Link
                          href="/unlock-estate"
                          className="flex items-center justify-between hover:underline"
                        >
                          <span>Complete Retirement Planning steps to unlock</span>
                          <span className="ml-1 shrink-0">→</span>
                        </Link>
                      )}
                    </div>
                  )}
                  {group.items.map((item) => {
                    if (item.consumerOnly && role === 'advisor') {
                      return null
                    }
                    if (groupIsLocked) {
                      return (
                        <div
                          key={item.href}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-300 cursor-default select-none"
                        >
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.advisorOnly && (
                            <span className="ml-auto shrink-0 rounded-full bg-blue-50 px-1.5 py-0 text-[10px] font-medium text-blue-400">
                              Advisor
                            </span>
                          )}
                        </div>
                      )
                    }
                    if (item.minTier && !isAdvisor && tier < item.minTier) {
                      return null
                    }
                    if (item.advisorOnly && !isAdvisor) {
                      return (
                        <div
                          key={item.href}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-300 cursor-default select-none"
                        >
                          <span className="flex-1 truncate">{item.label}</span>
                          <span className="ml-auto shrink-0 rounded-full bg-blue-50 px-1.5 py-0 text-[10px] font-medium text-blue-500">
                            Advisor
                          </span>
                        </div>
                      )
                    }
                    const isActive = activePath === item.href
                    const locked = isLocked(item.feature)
                    return (
                      <div key={item.href}>
                        <Link
                          href={item.href}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-neutral-900 text-white'
                              : locked
                                ? 'text-neutral-400 hover:bg-neutral-50'
                                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                          }`}
                        >
                          <span className="flex-1 truncate">{item.label}</span>
                          {locked && (
                            <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-1 py-0 text-[10px] font-medium text-amber-700">
                              🔒 {lockLabel(item.feature)}
                            </span>
                          )}
                        </Link>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Advisor Portal */}
        {role === 'advisor' && (
          <Link
            href="/advisor"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activePath === '/advisor' || activePath.startsWith('/advisor/')
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            💼 Advisor Portal
          </Link>
        )}

        {/* Attorney Portal */}
        {(role === 'attorney' || isAttorney) && (
          <Link
            href="/attorney"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activePath === '/attorney' || activePath.startsWith('/attorney/')
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            ⚖️ Attorney Portal
          </Link>
        )}

        {/* Admin Portal */}
        {(role === 'admin' || isAdmin) && (
          <Link
            href="/admin"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activePath === '/admin'
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            ⚙️ Admin Portal
          </Link>
        )}

        {/* Admin — Advisor Directory */}
        {(role === 'admin' || isAdmin) && (
          <Link
            href="/admin/advisor-directory"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activePath === '/admin/advisor-directory'
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            📋 Advisor Directory
          </Link>
        )}

        {(role === 'admin' || isAdmin) && (
          <Link
            href="/admin/attorney-directory"
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activePath === '/admin/attorney-directory'
                ? 'bg-neutral-100 text-neutral-900'
                : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
            }`}
          >
            ⚖️ Attorney Directory
          </Link>
        )}

        {/* Billing */}
        <Link
          href="/billing"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            activePath === '/billing'
              ? 'bg-neutral-900 text-white'
              : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
          }`}
        >
          💳 Billing
        </Link>
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-neutral-200">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
        >
          🚪 Sign out
        </button>
      </div>
    </aside>
  )
}
