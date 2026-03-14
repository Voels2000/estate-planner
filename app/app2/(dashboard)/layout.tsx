import { createClient } from '@/lib/supabase/server'
import { DashboardSidebar } from './_components/dashboard-sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const plan =
    (user?.user_metadata?.plan as 'Consumer' | 'Advisor' | undefined) ??
    'Consumer'

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-950">
      <DashboardSidebar
        userEmail={user?.email ?? null}
        plan={plan}
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
