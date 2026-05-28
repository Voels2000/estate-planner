'use client'
import { useState, type SyntheticEvent } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { FEATURE_TIERS, TIER_NAMES, hasFeatureAccess } from '@/lib/tiers'
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

const FINANCIAL_PLANNING_GROUP = 'Financial Planning'

const DEFAULT_CLOSED_GROUPS = new Set([
  FINANCIAL_PLANNING_GROUP,
  'Retirement Planning',
  'Estate Planning',
])

/** My Wealth Maps sidebar nav tokens (see CURSOR_PROMPT_TEMPLATE.md) */
const NAV_LINK_BASE =
  'flex items-center gap-3 py-2 text-sm font-medium transition-colors duration-150'
const NAV_ACTIVE =
  'rounded-r-lg rounded-l-none border-solid border-l-[3px] border-l-[color:var(--mwm-gold)] ' +
  'bg-[var(--mwm-navy)] text-white pl-[9px] pr-3 [box-shadow:inset_3px_0_0_var(--mwm-gold)]'
const NAV_INACTIVE =
  'rounded-lg px-3 text-[color:var(--mwm-text-secondary)] hover:bg-[var(--mwm-off-white)] hover:text-[color:var(--mwm-navy)]'

function navLinkClass(active: boolean, extra = '') {
  return `${NAV_LINK_BASE} ${active ? NAV_ACTIVE : NAV_INACTIVE} ${extra}`.trim()
}

/** Nav href may include `?query`; `usePathname()` returns the path only. */
function navHrefPath(href: string): string {
  return href.split('?')[0] ?? href
}

function isNavItemActive(itemHref: string, pathname: string): boolean {
  const hrefPath = navHrefPath(itemHref)
  if (hrefPath === '/dashboard') return pathname === '/dashboard'
  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`)
}

function groupContainsActiveItem(group: NavGroup, pathname: string): boolean {
  return group.items.some((item) => isNavItemActive(item.href, pathname))
}

function findActiveGroupLabel(pathname: string): string {
  for (const group of NAV_GROUPS) {
    if (groupContainsActiveItem(group, pathname)) return group.label
  }
  return 'Overview'
}
const SECTION_HEADER =
  'text-xs font-semibold tracking-widest text-[color:var(--mwm-text-muted)] uppercase'
const YOUR_PLAN_BADGE =
  'text-[10px] font-semibold tracking-wider uppercase bg-[var(--mwm-gold)] text-[color:var(--mwm-navy)] px-2 py-0.5 rounded-full'

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    icon: '🏠',
  items: [
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
      { href: '/digital-assets', label: 'Digital Assets', icon: '🔑', feature: 'digital-assets' },
      { href: '/business-succession', label: 'Business Succession', icon: '🏢', feature: 'business-succession' },
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
      { href: '/estate-tax', label: 'Estate Tax Snapshot', icon: '⚖️', feature: 'estate-tax' },
      { href: '/my-estate-strategy', label: 'Estate Value and Tax Horizons', icon: '📈' },
      { href: '/my-estate-trust-strategy?tab=trusts', label: 'Gifting, Strategies & Trusts', icon: '🏛️' },
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
  isTrial = false,
  isAdvisor = false,
  isAdmin = false,
  isAttorney = false,
  isSuperuser = false,
  hasHousehold = false,
  initialUnreadCount = 0,
}: {
  user: User
  role?: string
  tier?: number
  isTrial?: boolean
  isAdvisor?: boolean
  isAdmin?: boolean
  isAttorney?: boolean
  isSuperuser?: boolean
  hasHousehold?: boolean
  initialUnreadCount?: number
}) {
  const isLockedUser = hasHousehold === false && !isSuperuser && !isAdvisor && !isAdmin
  /** Superusers may keep role=consumer for smoke testing but still need portal links. */
  const showProfessionalPortals = role !== 'consumer' || isSuperuser
  const pathname = usePathname()
  const router = useRouter()

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const activePath = pathname
  const activeGroup = findActiveGroupLabel(pathname)
  const resolvedOpenGroups: Record<string, boolean> = Object.fromEntries(
    NAV_GROUPS.map((group) => {
      const hasActiveChild = groupContainsActiveItem(group, pathname)
      const defaultOpen =
        group.label === 'Overview' ||
        hasActiveChild ||
        (!DEFAULT_CLOSED_GROUPS.has(group.label) && group.label === activeGroup)
      const toggled = openGroups[group.label]
      return [group.label, hasActiveChild ? true : (toggled ?? defaultOpen)]
    }),
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
    return !hasFeatureAccess(feature, tier, isAdvisor, isTrial)
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
    <aside className="flex h-full w-full shrink-0 flex-col overflow-hidden rounded-xl border border-[color:var(--mwm-border)] bg-white lg:my-2 lg:ml-2 lg:w-64">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[color:var(--mwm-border)]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--mwm-gold)] font-[family-name:var(--font-display)] text-base font-semibold text-[color:var(--mwm-navy)]"
                aria-hidden
              >
                M
              </div>
              <span className="font-[family-name:var(--font-display)] text-sm font-medium leading-tight text-[color:var(--mwm-navy)]">
                My Wealth Maps
              </span>
            </div>
            <p className="text-xs text-[color:var(--mwm-text-muted)] mt-0.5 truncate">{user.email}</p>
            {!isAdvisor && (
              <span className="mt-1.5 inline-block rounded-full bg-[var(--mwm-off-white)] px-2 py-0.5 text-xs font-medium text-[color:var(--mwm-text-secondary)]">
                {TIER_NAMES[tier as 1 | 2 | 3] ?? 'Starter'} Plan
              </span>
            )}
          </div>
          <NotificationBell initialUnreadCount={initialUnreadCount} />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          const isOpen = resolvedOpenGroups[group.label] ?? false
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
                className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--mwm-off-white)] ${
                  groupIsLocked ? 'cursor-not-allowed' : ''
                } disabled:cursor-not-allowed disabled:opacity-100`}
              >
                <span className={`flex-1 text-left ${SECTION_HEADER}`}>{group.label}</span>
                {!groupIsLocked && group.label !== 'Overview' && (
                  ((group.label === 'Financial Planning' && tier === 1) ||
                   (group.label === 'Retirement Planning' && tier === 2) ||
                   (group.label === 'Estate Planning' && tier >= 3)) && (
                    <span className={`mr-1 ${YOUR_PLAN_BADGE}`}>Your plan</span>
                  )
                )}
                {groupIsLocked && (
                  <span className="text-amber-400 text-sm mr-1">🔒</span>
                )}
                <span className="text-[color:var(--mwm-text-muted)]">{isOpen ? '▾' : '▸'}</span>
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
                      (item.href === '/settings/attorney-access' || item.href === '/my-attorney') &&
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
                      item.href !== '/settings/attorney-access' &&
                      item.href !== '/my-attorney'
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
                      group.label !== FINANCIAL_PLANNING_GROUP &&
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
                      (item.href === '/settings/attorney-access' || item.href === '/my-attorney') && tierBelowMin
                    const linkHref = attorneyTierGate ? '/billing' : item.href
                    const isActive = isNavItemActive(item.href, activePath) && !attorneyTierGate
                    const locked = isLocked(item.feature)
                    const greyedLeaf = locked || attorneyTierGate
                    const leafClasses = navLinkClass(
                      isActive,
                      locked || attorneyTierGate
                        ? 'px-3 text-[color:var(--mwm-text-muted)] cursor-not-allowed'
                        : '',
                    )
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
        {showProfessionalPortals && (role === 'advisor' || isAdmin || isSuperuser) &&
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
              className={navLinkClass(
                activePath === '/advisor' || activePath.startsWith('/advisor/'),
              )}
            >
              💼 Advisor Portal
            </Link>
          ))}

        {/* Attorney Portal */}
        {showProfessionalPortals && (role === 'attorney' || isAttorney || isSuperuser) &&
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
              className={navLinkClass(
                activePath === '/attorney' || activePath.startsWith('/attorney/'),
              )}
            >
              ⚖️ Attorney Portal
            </Link>
          ))}

        {/* Admin Portal */}
        {showProfessionalPortals && (role === 'admin' || isAdmin || isSuperuser) &&
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
            <Link href="/admin" className={navLinkClass(activePath === '/admin')}>
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
                  ? NAV_ACTIVE
                  : NAV_INACTIVE
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
          <Link href="/print" className={navLinkClass(activePath === '/print')}>
            📄 Export Estate Plan
          </Link>
        )}

        {/* Import Data (tier 2+; was under Retirement Planning) */}
        {(isAdvisor || isSuperuser || hasFeatureAccess('import', tier, isAdvisor, isTrial)) &&
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
            <Link href="/import" className={navLinkClass(activePath === '/import')}>
              📥 Import Data
            </Link>
          ))}

        {/* Security — always available (password, MFA, privacy) */}
        <Link
          href="/settings/security"
          className={navLinkClass(activePath === '/settings/security')}
        >
          🔐 Security
        </Link>

      </nav>

      <div className="border-t border-[color:var(--mwm-border)]">
        <div className="px-3 pt-3 pb-1 space-y-0.5">
          {(role === 'consumer' || isSuperuser) && (
            <Link
              href="/education"
              className={navLinkClass(
                activePath === '/education' || activePath.startsWith('/education/'),
              )}
            >
              📖 Education Guide
            </Link>
          )}

          {(role === 'consumer' || isSuperuser) && (
            <Link href="/my-advisor" className={navLinkClass(activePath === '/my-advisor')}>
              👤 My Advisor
            </Link>
          )}

          {/* My Attorney — consumer only, tier 2+ */}
          {(role === 'consumer' || isSuperuser) && tier >= 2 &&
            (isLockedUser ? (
              <Link
                href="#"
                tabIndex={-1}
                aria-disabled={true}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors pointer-events-none opacity-40 cursor-not-allowed"
              >
                <span className="flex-1 truncate">⚖️ My Attorney</span>
                <span className="shrink-0 text-sm" aria-hidden>🔒</span>
              </Link>
            ) : (
              <Link href="/my-attorney" className={navLinkClass(activePath === '/my-attorney')}>
                ⚖️ My Attorney
              </Link>
            ))}

          <Link href="/billing" className={navLinkClass(activePath === '/billing')}>
            💳 Manage Subscription
          </Link>
        </div>

        <p className="mx-3 mb-2 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 text-[11px] leading-relaxed text-neutral-500 lg:hidden">
          Detailed estate and tax modeling is easiest on a desktop or tablet in landscape. You can
          review summaries here on your phone.
        </p>

        <div className="px-3 pb-4 pt-1 border-t border-[color:var(--mwm-border)]">
          <button
            onClick={handleSignOut}
            className={navLinkClass(false)}
          >
            🚪 Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
