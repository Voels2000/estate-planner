import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdvisorSignOut } from './_components/advisor-sign-out'

export default async function AdvisorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_superuser, firm_role')
    .eq('id', user.id)
    .single()

  const isAdvisor = profile?.role === 'advisor'
  const isSuperuser = profile?.is_superuser === true

  if (!isAdvisor && !isSuperuser) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-neutral-50">
      <nav className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-neutral-900">Estate Planner</h1>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            Advisor Portal
          </span>
        </div>
        <div className="flex items-center gap-4">
          {profile?.firm_role === 'owner' && (
            <a
              href="/advisor/firm"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              Firm Settings ⚙️
            </a>
          )}
          <span className="text-sm text-neutral-500">{user.email}</span>
          <AdvisorSignOut />
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-10">
        {children}
      </main>
    </div>
  )
}
