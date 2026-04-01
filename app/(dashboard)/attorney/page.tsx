import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AttorneyDashboardClient } from './_attorney-dashboard-client'

export default async function AttorneyDashboardPage() {
  const supabase = await createClient()

  // 1. Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Confirm attorney role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_attorney, full_name')
    .eq('id', user.id)
    .single()

  const isAttorney = profile?.role === 'attorney' || profile?.is_attorney === true
  if (!isAttorney) redirect('/dashboard')

  // 3. Fetch all active clients
  const { data: clients } = await supabase
    .from('attorney_clients')
    .select(`
      id,
      client_id,
      status,
      granted_at,
      advisor_pdf_access
    `)
    .eq('attorney_id', user.id)
    .in('status', ['active', 'accepted'])
    .order('granted_at', { ascending: false })

  // 4. Fetch household details for each client
  const householdIds = (clients ?? []).map(c => c.client_id).filter(Boolean)

  const { data: households } = householdIds.length > 0
    ? await supabase
        .from('households')
        .select(`
          id,
          name,
          person1_first_name,
          person1_last_name,
          person2_first_name,
          person2_last_name,
          state_primary,
          estate_complexity_flag,
          owner_id
        `)
        .in('id', householdIds)
    : { data: [] }

  // 5. Fetch owner profiles for each household
  const ownerIds = (households ?? []).map(h => h.owner_id).filter(Boolean)

  const { data: ownerProfiles } = ownerIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ownerIds)
    : { data: [] }

  // 6. Fetch document counts per household
  const { data: docCounts } = householdIds.length > 0
    ? await supabase
        .from('legal_documents')
        .select('household_id')
        .in('household_id', householdIds)
        .eq('is_current', true)
        .eq('is_deleted', false)
    : { data: [] }

  // 7. Shape data for client component
  const clientCards = (clients ?? []).map(client => {
    const household = (households ?? []).find(h => h.id === client.client_id)
    const owner = (ownerProfiles ?? []).find(p => p.id === household?.owner_id)
    const docCount = (docCounts ?? []).filter(d => d.household_id === client.client_id).length

    return {
      connection_id: client.id,
      household_id: client.client_id,
      granted_at: client.granted_at,
      advisor_pdf_access: client.advisor_pdf_access,
      full_name: owner?.full_name ?? 'Unknown Client',
      email: owner?.email ?? '',
      household_name: household?.name ?? '',
      state: household?.state_primary ?? '',
      complexity_flag: household?.estate_complexity_flag ?? '',
      doc_count: docCount,
    }
  })

  return (
    <AttorneyDashboardClient
      attorneyName={profile?.full_name ?? 'Attorney'}
      clients={clientCards}
    />
  )
}
