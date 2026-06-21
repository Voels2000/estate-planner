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
    <div className="min-h-screen bg-[var(--mwm-off-white)]">
      <nav className="flex items-center justify-between border-b border-[color:var(--mwm-navy)]/20 bg-[color:var(--mwm-navy)] px-6 py-3">
        <div className="flex items-center gap-4">
          <a
            href="/advisor"
            className="text-sm font-medium text-white/70 hover:text-white hover:underline"
          >
            ← Advisor Portal
          </a>
          <span className="text-sm font-semibold text-white">Prospect Mode</span>
        </div>
      </nav>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  )
}
