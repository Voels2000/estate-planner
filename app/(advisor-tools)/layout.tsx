import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdvisorToolsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-neutral-50">
      <nav className="bg-white border-b border-neutral-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/advisor" className="text-sm text-indigo-600 hover:underline">
            ← Advisor Portal
          </a>
          <span className="text-sm font-semibold text-neutral-900">Prospect Mode</span>
        </div>
      </nav>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  )
}
