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
      <nav className="bg-white border-b border-neutral-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-neutral-900">Estate Planner</h1>
          <span className="rounded-full bg-[var(--mwm-sage-pale)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--mwm-sage)]">
            Advisor Portal
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-[color:var(--mwm-sage)] hover:text-[color:var(--mwm-sage)] hover:underline"
          >
            📜 My Estate Plan
          </Link>
          {ctx.firm_role === 'owner' && (
            <a
              href="/advisor/firm"
              className="text-sm font-medium text-[color:var(--mwm-navy)] hover:text-[color:var(--mwm-navy)] hover:underline"
            >
              Firm Settings ⚙️
            </a>
          )}
          <span className="text-sm text-neutral-500">{ctx.user.email}</span>
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
