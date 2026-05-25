import { redirect } from 'next/navigation'
import { getAccessContext } from '@/lib/access/getAccessContext'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isAdmin } = await getAccessContext()

  if (!user) redirect('/login')
  if (!isAdmin) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[var(--mwm-off-white)]">
      <nav className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-neutral-900">Estate Planner Admin</h1>
          <span className="rounded-full bg-[var(--mwm-gold-pale)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--mwm-navy)]">Admin</span>
        </div>
        <a href="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-700">
          ← Back to App
        </a>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-10">
        {children}
      </main>
    </div>
  )
}
