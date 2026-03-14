'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/profile', label: 'Profile' },
  { href: '/assets', label: 'Assets' },
  { href: '/income', label: 'Income' },
  { href: '/expenses', label: 'Expenses' },
  { href: '/projections', label: 'Projections' },
  { href: '/scenarios', label: 'Scenarios' },
] as const

type PlanType = 'Consumer' | 'Advisor'

interface DashboardSidebarProps {
  userEmail: string | null
  plan: PlanType
}

export function DashboardSidebar({ userEmail, plan }: DashboardSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = userEmail
    ? userEmail
        .slice(0, 2)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '?')
    : '?'

  return (
    <aside className="flex h-full w-64 flex-col border-r border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/80">
      {/* Logo / brand */}
      <div className="flex h-16 shrink-0 items-center border-b border-zinc-200 px-5 dark:border-zinc-800">
        <Link
          href="/dashboard"
          className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Estate Planner
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navItems.map(({ href, label }) => {
          const isActive =
            (href === '/dashboard' && pathname.startsWith('/dashboard')) ||
            (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50'
                  : 'text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700/80 dark:hover:text-zinc-50'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User block */}
      <div className="shrink-0 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <div className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-sm font-medium text-zinc-100 dark:bg-zinc-600 dark:text-zinc-200"
            aria-hidden
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {userEmail ?? 'Guest'}
            </p>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                plan === 'Advisor'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-600 dark:text-zinc-300'
              }`}
            >
              {plan}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Log out
        </button>
      </div>
    </aside>
  )
}
