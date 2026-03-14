import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardOverviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Overview
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Your estate planning dashboard. Use the sidebar to navigate.
      </p>
    </div>
  )
}
