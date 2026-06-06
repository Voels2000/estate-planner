/**
 * Advisor portal layout (server).
 *
 * Enforces advisor access, renders top navigation/tabs, and wraps advisor routes.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { AdvisorSignOut } from './_components/advisor-sign-out'
import { AdvisorTabs } from './_components/advisor-tabs'

export default async function AdvisorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getAccessContext()
  if (!ctx.user) redirect('/login')

  if (!ctx.isAdvisor) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[var(--mwm-off-white)]">
      <nav className="border-b border-[color:var(--mwm-navy)]/20 bg-[color:var(--mwm-navy)] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold text-sm tracking-wide">Estate Planner</span>
          <span className="rounded-full border border-[color:var(--mwm-gold)]/40 bg-[color:var(--mwm-gold)]/20 px-2.5 py-0.5 text-xs font-medium text-[color:var(--mwm-gold)]">
            Advisor Portal
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          {ctx.firm_name ? (
            <span className="text-sm font-medium text-white/80">{ctx.firm_name}</span>
          ) : null}
          <Link
            href="/dashboard"
            className="text-sm font-medium text-white/70 hover:text-white hover:underline"
          >
            📜 My Estate Plan
          </Link>
          {ctx.firm_role === 'owner' && (
            <a
              href="/advisor/firm"
              className="text-sm font-medium text-white/70 hover:text-white hover:underline"
            >
              Firm Settings ⚙️
            </a>
          )}
          <span className="text-sm text-white/60">{ctx.user.email}</span>
          <Link
            href="/advisor/settings"
            className="text-sm font-medium text-white/70 hover:text-white hover:underline"
          >
            Profile ⚙️
          </Link>
          <AdvisorSignOut />
        </div>
      </nav>
      <div className="bg-white">
        <div className="mx-auto max-w-7xl px-4 pt-2">
          <AdvisorTabs showFirmSettingsTab={ctx.firm_role === 'owner'} />
        </div>
      </div>
      <main className="mx-auto max-w-7xl px-4 pt-4 pb-10" style={{ overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
