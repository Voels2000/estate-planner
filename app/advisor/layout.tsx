import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'advisor') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-neutral-50">
      <nav className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-neutral-900">Estate Planner</h1>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            Advisor Portal
          </span>
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
