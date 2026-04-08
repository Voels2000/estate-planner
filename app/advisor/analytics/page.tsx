// Sprint 62 — Book-of-Business Analytics dashboard
// Server component — fetches advisor ID then renders client component

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AnalyticsDashboardClient from './_analytics-client'

export default async function AnalyticsDashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'advisor') redirect('/dashboard')

  return (
    <AnalyticsDashboardClient
      advisorId={user.id}
      advisorName={profile?.full_name ?? 'Advisor'}
    />
  )
}
