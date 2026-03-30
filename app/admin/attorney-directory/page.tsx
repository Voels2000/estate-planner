import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AdminAttorneyDirectoryClient } from './_admin-attorney-directory-client'

export default async function AdminAttorneyDirectoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.is_admin !== true) redirect('/dashboard')

  const admin = createAdminClient()

  const { data: attorneys } = await admin
    .from('attorney_listings')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: referrals } = await admin
    .from('attorney_referrals')
    .select(`
      id, status, trigger_reason, notes, created_at, status_updated_at,
      requested_by, attorney_id, advisor_id,
      consumer:profiles!attorney_referrals_requested_by_fkey(id, email, full_name),
      attorney:attorney_listings!attorney_referrals_attorney_id_fkey(id, firm_name, email)
    `)
    .order('created_at', { ascending: false })

  return (
    <AdminAttorneyDirectoryClient
      attorneys={attorneys ?? []}
      referrals={referrals ?? []}
    />
  )
}
