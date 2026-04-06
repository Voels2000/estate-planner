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
    <div className="min-h-screen bg-neutral-50">
      <nav className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-neutral-900">Estate Planner</h1>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            Advisor Portal
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-emerald-800 hover:text-emerald-950 hover:underline"
          >
            📜 My Estate Plan
          </Link>
          {ctx.firm_role === 'owner' && (
            <a
              href="/advisor/firm"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
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
      <main className="mx-auto max-w-7xl px-4 py-10">
        {children}
      </main>
    </div>
  )
}
