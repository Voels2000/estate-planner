'use client'

import Link from 'next/link'
import type { OpsInboxCounts } from './ops-home-tab'

export type AdminTabKey =
  | 'ops_home'
  | 'overview'
  | 'users'
  | 'usage'
  | 'feedback'
  | 'funnel'
  | 'waitlist'
  | 'compliance'
  | 'directories'
  | 'settings'
  | 'tiers'
  | 'categories'
  | 'tax_rules'
  | 'terms'
  | 'debug'

const TAB_TITLES: Record<AdminTabKey, string> = {
  ops_home: 'Ops home',
  overview: 'Overview',
  users: 'Users',
  usage: 'Usage',
  feedback: 'Feedback',
  funnel: 'Funnel',
  waitlist: 'Waitlist',
  compliance: 'Data & Compliance',
  directories: 'Directories',
  settings: 'Settings',
  tiers: 'Advisor tiers',
  categories: 'Categories',
  tax_rules: 'Tax rules',
  terms: 'Terms & Conditions',
  debug: 'Debug',
}

type NavItem = {
  key: AdminTabKey
  label: string
  icon: string
  badge?: number
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Operations',
    items: [
      { key: 'ops_home', label: 'Ops home', icon: '⚡' },
      { key: 'compliance', label: 'Compliance', icon: '🔒' },
      { key: 'directories', label: 'Directories', icon: '📇' },
      { key: 'waitlist', label: 'Waitlist', icon: '📋' },
      { key: 'feedback', label: 'Feedback', icon: '💬' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { key: 'overview', label: 'Overview', icon: '📊' },
      { key: 'users', label: 'Users', icon: '👥' },
      { key: 'funnel', label: 'Funnel', icon: '📉' },
      { key: 'usage', label: 'Usage', icon: '📈' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { key: 'tax_rules', label: 'Tax rules', icon: '🏛️' },
      { key: 'terms', label: 'T&C', icon: '📄' },
      { key: 'categories', label: 'Categories', icon: '🗂️' },
      { key: 'tiers', label: 'Advisor tiers', icon: '🏷️' },
      { key: 'settings', label: 'Settings', icon: '⚙️' },
    ],
  },
  {
    label: 'Developer',
    items: [{ key: 'debug', label: 'Debug', icon: '🐛' }],
  },
]

function formatFetchedSubtitle(fetchedAt: string): string {
  const date = new Date(fetchedAt).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const mins = Math.max(0, Math.floor((Date.now() - new Date(fetchedAt).getTime()) / 60000))
  const refreshed = mins < 1 ? 'just now' : `${mins}m ago`
  return `${date} · Last refreshed ${refreshed}`
}

export function AdminTabHeader({
  tab,
  fetchedAt,
}: {
  tab: AdminTabKey
  fetchedAt: string
}) {
  return (
    <div className="mb-5">
      <h1 className="text-base font-medium text-neutral-900">{TAB_TITLES[tab]}</h1>
      <p className="text-xs text-neutral-500 mt-0.5">{formatFetchedSubtitle(fetchedAt)}</p>
    </div>
  )
}

type SidebarProps = {
  activeTab: AdminTabKey
  onSelectTab: (tab: AdminTabKey) => void
  inboxCounts: OpsInboxCounts
  pendingAdvisorDirectory: number
  pendingAttorneyDirectory: number
}

export function AdminSidebar({
  activeTab,
  onSelectTab,
  inboxCounts,
  pendingAdvisorDirectory,
  pendingAttorneyDirectory,
}: SidebarProps) {
  const totalAlerts =
    inboxCounts.overdueTasks + inboxCounts.dueTodayTasks + inboxCounts.staleCrons
  const directoryPending = pendingAdvisorDirectory + pendingAttorneyDirectory

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      let badge: number | undefined
      if (item.key === 'ops_home' && totalAlerts > 0) badge = totalAlerts
      if (item.key === 'directories' && directoryPending > 0) badge = directoryPending
      return { ...item, badge }
    }),
  }))

  return (
    <aside className="border-r border-neutral-200 bg-white flex flex-col min-h-[calc(100vh-0px)]">
      <div className="h-12 px-4 flex items-center justify-between border-b border-neutral-200 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-neutral-900 truncate">My Wealth Maps</span>
          <span className="rounded px-1.5 py-0.5 text-[11px] font-medium bg-blue-50 text-blue-700 shrink-0">
            Admin
          </span>
        </div>
        <Link href="/dashboard" className="text-xs text-neutral-500 hover:text-neutral-800 shrink-0">
          ← Back to app
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-4 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              {group.label}
            </p>
            {group.items.map((item) => {
              const isActive = activeTab === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelectTab(item.key)}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition ${
                    isActive
                      ? 'border-r-2 border-neutral-900 bg-neutral-50 font-medium text-neutral-900'
                      : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                >
                  <span className="text-[15px] leading-none" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
