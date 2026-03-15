'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/profile', label: 'Profile', icon: '👤' },
  { href: '/assets', label: 'Assets', icon: '🏦' },
  { href: '/liabilities', label: 'Liabilities', icon: '💳' },
  { href: '/income', label: 'Income', icon: '💰' },
  { href: '/expenses', label: 'Expenses', icon: '💸' },
  { href: '/projections', label: 'Projections', icon: '📈' },
  { href: '/scenarios', label: 'Scenarios', icon: '🔮' },
  { href: '/billing', label: 'Billing', icon: '💳' },
]

export function SidebarNav({ user, role }: { user: User; role?: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-64 shrink-0 border-r border-neutral-200 bg-white flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-neutral-200">
        <h1 className="text-lg font-bold text-neutral-900">Estate Planner</h1>
        <p className="text-xs text-neutral-500 mt-0.5 truncate">{user.email}</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
        {role === 'advisor' && (
          <Link
            href="/advisor"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              pathname === '/advisor' || pathname.startsWith('/advisor/')
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
              pathname === '/admin'
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            <span className="text-base">⚙️</span>
            Admin Portal
          </Link>
        )}
      </nav>

      {/* Sign out */}
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
