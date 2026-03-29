import { createClient } from '@/lib/supabase/server'
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

  const { data: attorneys } = await supabase
    .from('attorney_listings')
    .select('*')
    .order('created_at', { ascending: false })

  return <AdminAttorneyDirectoryClient attorneys={attorneys ?? []} />
}
