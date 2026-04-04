'use client'
import { useState, useEffect, type SyntheticEvent } from 'react'
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
      { href: '/profile', label: 'Profile', icon: '👤', feature: 'profile' },
      { href: '/dashboard', label: 'Dashboard', icon: '📊', feature: 'dashboard' },
      { href: '/settings/security', label: 'Security', icon: '🔐', feature: 'profile' },
      { href: '/my-advisor', label: 'My Advisor', icon: '👤', consumerOnly: true },
      { href: '/settings/attorney-access', label: 'My Attorney', icon: '⚖️', minTier: 2 },
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
      { href: '/import', label: 'Import Data', icon: '📥', feature: 'import', minTier: 2 },
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
      { href: '/estate-tax', label: 'Estate Tax', icon: '⚖️', feature: 'estate-tax' },
      { href: '/gifting', label: 'Gifting Strategy', icon: '🎁', feature: 'gifting' },
      { href: '/charitable', label: 'Charitable Giving', icon: '🤝', feature: 'charitable' },
      { href: '/business-succession', label: 'Business Succession', icon: '🏢', feature: 'business-succession', advisorOnly: false, minTier: 3 },
      { href: '/trust-will', label: 'Trust & Will Guidance', icon: '📋', minTier: 3 },
      { href: '/print', label: 'Export Estate Plan', icon: '📄', minTier: 3 },
    ],
  },
  {
    label: 'Resources',
    icon: '📚',
    items: [
      { href: '/attorney-directory', label: 'Find an Attorney', icon: '⚖️' },
      { href: '/list-your-practice', label: 'List Your Practice', icon: '📋', advisorOnly: true },
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
  isSuperuser = false,
}: {
  user: User
  role?: string
  tier?: number
  isAdvisor?: boolean
  isAdmin?: boolean
  isAttorney?: boolean
  isSuperuser?: boolean
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
    setOpenGroups(prev => ({
      ...prev,
      [activeGroup]: true,
      // Keep Overview always open so My Attorney and My Advisor
      // remain visible regardless of which page the consumer is on
      'Overview': true,
    }))
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
    if (isSuperuser) return false
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

  function blockLockedNavInteraction(e: SyntheticEvent) {
    e.preventDefault()
    e.stopPropagation()
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
          if (group.label === 'Resources' && role === 'consumer' && !isAdvisor) {
            return null
          }
          const isOpen = openGroups[group.label] ?? false
          const hasActive = group.items.some(item => item.href === activePath)
          const groupIsLocked =
            !isSuperuser &&
            group.locked === true &&
            !isAdvisor &&
            ((group.label === 'Retirement Planning' && tier < 2) ||
              (group.label === 'Estate Planning' && tier < 3))

          return (
            <div key={group.label}>
              <button
                type="button"
                disabled={groupIsLocked}
                onClick={() => toggleGroup(group.label)}
                className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  hasActive
                    ? 'text-neutral-900 bg-neutral-50'
                    : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50'
                } ${groupIsLocked ? 'cursor-not-allowed' : ''} disabled:cursor-not-allowed disabled:opacity-100`}
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
                    // Hide consumerOnly items from non-consumers
                    if (item.consumerOnly && role !== 'consumer' && !isSuperuser) {
                      return null
                    }
                    // My Attorney: consumer accounts only (no consumerOnly flag on item)
                    if (
                      item.href === '/settings/attorney-access' &&
                      role !== 'consumer' &&
                      !isSuperuser
                    ) {
                      return null
                    }
                    // Hide advisorOnly items from non-advisors entirely
                    if (item.advisorOnly && !isAdvisor && !isSuperuser) {
                      return null
                    }
                    // Hide tier-gated items consumer will never reach (My Attorney: shown, greyed + billing)
                    if (
                      item.minTier &&
                      !isAdvisor &&
                      !isSuperuser &&
                      tier < item.minTier &&
                      item.href !== '/settings/attorney-access'
                    ) {
                      return null
                    }
                    if (groupIsLocked) {
                      return (
                        <div
                          key={item.href}
                          role="presentation"
                          onClick={blockLockedNavInteraction}
                          onPointerDown={blockLockedNavInteraction}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-300 cursor-not-allowed select-none"
                        >
                          <span className="flex-1 truncate">{item.label}</span>
                        </div>
                      )
                    }
                    const tierBelowMin =
                      Boolean(item.minTier) &&
                      !isAdvisor &&
                      !isSuperuser &&
                      tier < (item.minTier ?? 0)
                    const attorneyTierGate =
                      item.href === '/settings/attorney-access' && tierBelowMin
                    const linkHref = attorneyTierGate ? '/billing' : item.href
                    const isActive = activePath === item.href && !attorneyTierGate
                    const locked = isLocked(item.feature)
                    const greyedLeaf = locked || attorneyTierGate
                    const leafClasses = `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-neutral-900 text-white'
                        : locked || attorneyTierGate
                          ? 'text-neutral-400 hover:bg-neutral-50'
                          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                    }`
                    return (
                      <div key={item.href}>
                        {greyedLeaf ? (
                          <div
                            role="presentation"
                            onClick={blockLockedNavInteraction}
                            onPointerDown={blockLockedNavInteraction}
                            className={`${leafClasses} cursor-not-allowed`}
                          >
                            <span className="flex-1 truncate">{item.label}</span>
                            {locked && (
                              <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-1 py-0 text-[10px] font-medium text-amber-700">
                                🔒 {lockLabel(item.feature)}
                              </span>
                            )}
                            {attorneyTierGate && (
                              <span className="ml-auto shrink-0 text-amber-400 text-sm">🔒</span>
                            )}
                          </div>
                        ) : (
                          <Link href={linkHref} className={leafClasses}>
                            <span className="flex-1 truncate">{item.label}</span>
                          </Link>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Advisor Portal */}
        {(role === 'advisor' || isSuperuser) && (
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
        {(role === 'attorney' || isAttorney || isSuperuser) && (
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
        {(role === 'admin' || isAdmin || isSuperuser) && (
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
        {(role === 'admin' || isAdmin || isSuperuser) && (
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

        {(role === 'admin' || isAdmin || isSuperuser) && (
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
          💳 Manage Subscription
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
