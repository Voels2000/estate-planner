import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { AdminAdvisorDirectoryClient } from './_admin-advisor-directory-client'

export default async function AdminAdvisorDirectoryPage() {
  const { user, isAdmin } = await getAccessContext()
  if (!user) redirect('/login')
  if (!isAdmin) redirect('/dashboard')

  const admin = createAdminClient()

  const { data: advisors } = await admin
    .from('advisor_directory')
    .select('*')
    .order('created_at', { ascending: false })

  return <AdminAdvisorDirectoryClient advisors={advisors ?? []} />
}
