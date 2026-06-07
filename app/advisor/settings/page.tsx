/**
 * Advisor profile settings — export branding on profiles row.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext } from '@/lib/access/getAccessContext'
import SettingsClient from './_settings-client'

export default async function AdvisorSettingsPage() {
  const access = await getAccessContext()

  if (!access.user) {
    redirect('/login')
  }
  if (!access.isAdvisor) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, email, firm_name, phone, firm_logo_url')
    .eq('id', access.user.id)
    .maybeSingle()

  if (error) {
    console.error('[advisor/settings] profile load failed:', error)
  }

  return (
    <SettingsClient
      initialProfile={{
        full_name: profile?.full_name ?? null,
        email: profile?.email ?? access.user.email ?? null,
        firm_name: profile?.firm_name ?? null,
        phone: profile?.phone ?? null,
        firm_logo_url: profile?.firm_logo_url ?? null,
      }}
    />
  )
}
