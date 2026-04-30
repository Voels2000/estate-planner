'use client'
import { useState, type SyntheticEvent } from 'react'
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
  minTier?: number
}

type NavGroup = {
  label: string
  icon: string
  items: NavItem[]
  locked?: boolean
}

const DEFAULT_CLOSED_GROUPS = new Set([
  'Financial Planning',
  'Retirement Planning',
  'Estate Planning',
])

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    icon: '🏠',
  items: [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/education', label: 'Education Guide', icon: '📚' },
    { href: '/assess', label: 'Planning Assessment', icon: '🔍' },
    { href: '/profile', label: 'Profile', icon: '👤', feature: 'profile' },
    { href: '/dashboard', label: 'Estate Summary', icon: '📊', feature: 'dashboard' },
  ],
  },
  {
    label: 'Financial Planning',
    icon: '💰',
    items: [
      { href: '/income', label: 'Income', icon: '💰', feature: 'income' },
      { href: '/expenses', label: 'Expenses', icon: '💸', feature: 'expenses' },
      { href: '/assets', label: 'Assets', icon: '🏦', feature: 'assets' },
      { href: '/real-estate', label: 'Real Estate', icon: '🏠', feature: 'real-estate' },
      { href: '/businesses', label: 'Business Interests', icon: '🏢', feature: 'businesses' },
      { href: '/digital-assets', label: 'Digital Assets', icon: '🔑' },
      { href: '/liabilities', label: 'Liabilities', icon: '💳', feature: 'liabilities' },
      { href: '/insurance', label: 'Life & Estate Insurance', icon: '🛡️', feature: 'insurance' },
      { href: '/property-casualty', label: 'Property & Casualty', icon: '🏠', feature: 'insurance' },
      { href: '/allocation', label: 'Asset Allocation', icon: '📐', feature: 'allocation' },
      { href: '/projections', label: 'Projections', icon: '📈', feature: 'projections' },
      { href: '/scenarios', label: 'Scenarios', icon: '🔮', feature: 'scenarios' },
    ],
  },
  // Retirement Planning before Estate Planning (Sprint 55)
  {
    label: 'Retirement Planning',
    icon: '🏖️',
    locked: true,
    items: [
      { href: '/social-security', label: 'Social Security', icon: '🏛️', feature: 'social-security' },
      { href: '/rmd', label: 'RMD Calculator', icon: '📋', feature: 'rmd' },
      { href: '/roth', label: 'Roth Conversion', icon: '🔄', feature: 'roth' },
      { href: '/complete', label: 'Lifetime Snapshot', icon: '📊', feature: 'complete' },
      { href: '/monte-carlo', label: 'Monte Carlo', icon: '📊', feature: 'monte-carlo' },
    ],
  },
  {
    label: 'Estate Planning',
    icon: '📜',
    locked: true,
    items: [
      { href: '/my-family', label: 'My Family', icon: '👨‍👩‍👧‍👦', feature: 'my-family' },
      { href: '/titling', label: 'Titling & Beneficiaries', icon: '📜', feature: 'titling' },
      { href: '/incapacity-planning', label: 'Incapacity Planning', icon: '🏥', feature: 'incapacity' },
      { href: '/domicile-analysis', label: 'Domicile Analysis', icon: '🗺️', feature: 'domicile-analysis' },
      // { href: '/business-succession', label: 'Business Succession', icon: '🏢', feature: 'business-succession', advisorOnly: false, minTier: 3 },
      { href: '/estate-tax', label: 'Estate Tax Snapshot', icon: '⚖️', feature: 'estate-tax' },
      { href: '/my-estate-strategy', label: 'Estate Value and Tax Horizons', icon: '📈' },
      { href: '/my-estate-trust-strategy', label: 'Gifting, Strategies & Trusts', icon: '🏛️' },
      // Export Estate Plan removed here — lives exclusively in Advisor Portal tabs (Sprint 55)
    ],
  },
  // Resources group removed entirely (Sprint 55).
  // Find an Attorney, List Your Practice, and Export Estate Plan
  // are now tabs in the Advisor Portal (/advisor). No resource menu
  // exists in the consumer view or in the advisor's own estate dashboard.
]

export function SidebarNav({
  user,
  role,
  tier = 1,
  isAdvisor = false,
  isAdmin = false,
  isAttorney = false,
  isSuperuser = false,
  hasHousehold = false,
}: {
  user: User
  role?: string
  tier?: number
  isAdvisor?: boolean
  isAdmin?: boolean
  isAttorney?: boolean
  isSuperuser?: boolean
  hasHousehold?: boolean
}) {
  const isLockedUser = hasHousehold === false
  const pathname = usePathname()
  const router = useRouter()

  function getActiveGroup(): string {
    for (const group of NAV_GROUPS) {
      if (group.items.some(item => item.href === pathname)) return group.label
    }
    return 'Overview'
  }

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const activePath = pathname
  const activeGroup = getActiveGroup()
  const resolvedOpenGroups: Record<string, boolean> = Object.fromEntries(
    NAV_GROUPS.map((group) => [
      group.label,
      openGroups[group.label] ??
        (group.label === 'Overview' || (!DEFAULT_CLOSED_GROUPS.has(group.label) && group.label === activeGroup)),
    ]),
  )

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
    <aside className="ml-2 my-2 w-64 shrink-0 border border-neutral-200 bg-white flex flex-col rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-neutral-200">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div style={{
                width: 28, height: 28,
                background: '#c9a84c',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600, fontSize: 13,
                color: '#0f1f3d',
                flexShrink: 0,
              }}>M</div>
              <h1 className="text-base font-bold text-neutral-900">
                My Wealth Maps
              </h1>
            </div>
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
          const isOpen = resolvedOpenGroups[group.label] ?? false
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
                    ? 'bg-indigo-50 text-indigo-900'
                    : 'text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600'
                } ${groupIsLocked ? 'cursor-not-allowed' : ''} disabled:cursor-not-allowed disabled:opacity-100`}
              >
                <span className="flex-1 text-left text-neutral-900">{group.label}</span>
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
                    if (item.consumerOnly && role !== 'consumer' && !isSuperuser) {
                      return null
                    }
                    if (
                      item.href === '/settings/attorney-access' &&
                      role !== 'consumer' &&
                      !isSuperuser
                    ) {
                      return null
                    }
                    if (item.advisorOnly && !isAdvisor && !isSuperuser) {
                      return null
                    }
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
                    if (
                      isLockedUser &&
                      item.href !== '/profile' &&
                      item.href !== '/dashboard' &&
                      item.href !== '/education'
                    ) {
                      return (
                        <div key={item.href}>
                          <Link
                            href="#"
                            tabIndex={-1}
                            aria-disabled={true}
                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors pointer-events-none opacity-40 cursor-not-allowed"
                          >
                            <span className="flex-1 truncate">{item.label}</span>
                            <span className="shrink-0 text-sm" aria-hidden>
                              🔒
                            </span>
                          </Link>
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
                        ? 'bg-indigo-600 text-white shadow-sm'
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
        {(role === 'advisor' || isSuperuser) &&
          (isLockedUser ? (
            <Link
              href="#"
              tabIndex={-1}
              aria-disabled={true}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors pointer-events-none opacity-40 cursor-not-allowed"
            >
              <span className="flex-1 truncate">💼 Advisor Portal</span>
              <span className="shrink-0 text-sm" aria-hidden>
                🔒
              </span>
            </Link>
          ) : (
            <Link
              href="/advisor"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activePath === '/advisor' || activePath.startsWith('/advisor/')
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              💼 Advisor Portal
            </Link>
          ))}

        {/* Attorney Portal */}
        {(role === 'attorney' || isAttorney || isSuperuser) &&
          (isLockedUser ? (
            <Link
              href="#"
              tabIndex={-1}
              aria-disabled={true}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors pointer-events-none opacity-40 cursor-not-allowed"
            >
              <span className="flex-1 truncate">⚖️ Attorney Portal</span>
              <span className="shrink-0 text-sm" aria-hidden>
                🔒
              </span>
            </Link>
          ) : (
            <Link
              href="/attorney"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activePath === '/attorney' || activePath.startsWith('/attorney/')
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              ⚖️ Attorney Portal
            </Link>
          ))}

        {/* Admin Portal */}
        {(role === 'admin' || isAdmin || isSuperuser) &&
          (isLockedUser ? (
            <Link
              href="#"
              tabIndex={-1}
              aria-disabled={true}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors pointer-events-none opacity-40 cursor-not-allowed"
            >
              <span className="flex-1 truncate">⚙️ Admin Portal</span>
              <span className="shrink-0 text-sm" aria-hidden>
                🔒
              </span>
            </Link>
          ) : (
            <Link
              href="/admin"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activePath === '/admin'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              ⚙️ Admin Portal
            </Link>
          ))}

        {/* Admin — Advisor Directory */}
        {/*
        {(role === 'admin' || isAdmin || isSuperuser) &&
          (isLockedUser ? (
            <Link
              href="#"
              tabIndex={-1}
              aria-disabled={true}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors pointer-events-none opacity-40 cursor-not-allowed"
            >
              <span className="flex-1 truncate">📋 Advisor Directory</span>
              <span className="shrink-0 text-sm" aria-hidden>
                🔒
              </span>
            </Link>
          ) : (
            <Link
              href="/admin/advisor-directory"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activePath === '/admin/advisor-directory'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              📋 Advisor Directory
            </Link>
          ))}
        */}

        {/*
        {(role === 'admin' || isAdmin || isSuperuser) &&
          (isLockedUser ? (
            <Link
              href="#"
              tabIndex={-1}
              aria-disabled={true}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors pointer-events-none opacity-40 cursor-not-allowed"
            >
              <span className="flex-1 truncate">⚖️ Attorney Directory</span>
              <span className="shrink-0 text-sm" aria-hidden>
                🔒
              </span>
            </Link>
          ) : (
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
          ))}
        */}

        {/* My Advisor (consumer) */}
        {(role === 'consumer' || isSuperuser) &&
          (isLockedUser ? (
            <Link
              href="#"
              tabIndex={-1}
              aria-disabled={true}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors pointer-events-none opacity-40 cursor-not-allowed"
            >
              <span className="flex-1 truncate">👤 My Advisor</span>
              <span className="shrink-0 text-sm" aria-hidden>
                🔒
              </span>
            </Link>
          ) : (
            <Link
              href="/my-advisor"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activePath === '/my-advisor'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              👤 My Advisor
            </Link>
          ))}

        {/* My Attorney (consumer, tier 2+) */}
        {(role === 'consumer' || isSuperuser) &&
          (isLockedUser ? (
            <Link
              href="#"
              tabIndex={-1}
              aria-disabled={true}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors pointer-events-none opacity-40 cursor-not-allowed"
            >
              <span className="flex-1 truncate">⚖️ My Attorney</span>
              <span className="shrink-0 text-sm" aria-hidden>
                🔒
              </span>
            </Link>
          ) : (() => {
            const tierBelowMin =
              !isAdvisor && !isSuperuser && tier < 2
            const attorneyTierGate = tierBelowMin
            const linkHref = attorneyTierGate ? '/billing' : '/settings/attorney-access'
            const isActive =
              activePath === '/settings/attorney-access' && !attorneyTierGate
            const leafClasses = `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-indigo-600 text-white shadow-sm'
                : attorneyTierGate
                  ? 'text-neutral-400 hover:bg-neutral-50'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
            }`
            return attorneyTierGate ? (
              <div
                role="presentation"
                onClick={blockLockedNavInteraction}
                onPointerDown={blockLockedNavInteraction}
                className={`${leafClasses} cursor-not-allowed`}
              >
                <span className="flex-1 truncate">⚖️ My Attorney</span>
                <span className="ml-auto shrink-0 text-amber-400 text-sm">🔒</span>
              </div>
            ) : (
              <Link href={linkHref} className={leafClasses}>
                <span className="flex-1 truncate">⚖️ My Attorney</span>
              </Link>
            )
          })())}

        {/* Export Estate Plan */}
        {isLockedUser ? (
          <Link
            href="#"
            tabIndex={-1}
            aria-disabled={true}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors pointer-events-none opacity-40 cursor-not-allowed"
          >
            <span className="flex-1 truncate">📄 Export Estate Plan</span>
            <span className="shrink-0 text-sm" aria-hidden>
              🔒
            </span>
          </Link>
        ) : (
          <Link
            href="/print"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activePath === '/print'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            📄 Export Estate Plan
          </Link>
        )}

        {/* Import Data (tier 2+; was under Retirement Planning) */}
        {(isAdvisor || isSuperuser || tier >= 2) &&
          (isLockedUser ? (
            <Link
              href="#"
              tabIndex={-1}
              aria-disabled={true}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors pointer-events-none opacity-40 cursor-not-allowed"
            >
              <span className="flex-1 truncate">📥 Import Data</span>
              <span className="shrink-0 text-sm" aria-hidden>
                🔒
              </span>
            </Link>
          ) : isLocked('import') ? (
            <div
              role="presentation"
              onClick={blockLockedNavInteraction}
              onPointerDown={blockLockedNavInteraction}
              className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-400 hover:bg-neutral-50"
            >
              <span className="flex-1 truncate">📥 Import Data</span>
              <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-1 py-0 text-[10px] font-medium text-amber-700">
                🔒 {lockLabel('import')}
              </span>
            </div>
          ) : (
            <Link
              href="/import"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activePath === '/import'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              📥 Import Data
            </Link>
          ))}

        {/* Security */}
        {isLockedUser ? (
          <Link
            href="#"
            tabIndex={-1}
            aria-disabled={true}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors pointer-events-none opacity-40 cursor-not-allowed"
          >
            <span className="flex-1 truncate">🔐 Security</span>
            <span className="shrink-0 text-sm" aria-hidden>
              🔒
            </span>
          </Link>
        ) : isLocked('profile') ? (
          <div
            role="presentation"
            onClick={blockLockedNavInteraction}
            onPointerDown={blockLockedNavInteraction}
            className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-400 hover:bg-neutral-50"
          >
            <span className="flex-1 truncate">🔐 Security</span>
            <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-1 py-0 text-[10px] font-medium text-amber-700">
              🔒 {lockLabel('profile')}
            </span>
          </div>
        ) : (
          <Link
            href="/settings/security"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activePath === '/settings/security'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            🔐 Security
          </Link>
        )}

        {/* Billing */}
        {isLockedUser ? (
          <Link
            href="#"
            tabIndex={-1}
            aria-disabled={true}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors pointer-events-none opacity-40 cursor-not-allowed"
          >
            <span className="flex-1 truncate">💳 Manage Subscription</span>
            <span className="shrink-0 text-sm" aria-hidden>
              🔒
            </span>
          </Link>
        ) : (
          <Link
            href="/billing"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activePath === '/billing'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            💳 Manage Subscription
          </Link>
        )}
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
