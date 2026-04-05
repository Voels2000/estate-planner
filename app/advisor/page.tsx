import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext } from '@/lib/access/getAccessContext'
import AdvisorClient from './_advisor-client'

export default async function AdvisorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getAccessContext()
  const isFirmOwner = access.isFirmOwner
  const firm_name = access.firm_name
  const firm_id = access.firm_id

  // Fetch all clients linked to this advisor
  const { data: advisorClients } = await supabase
    .from('advisor_clients')
    .select(`
      id,
      status,
      client_status,
      invited_at,
      accepted_at,
      client_id,
      invited_email,
      request_message,
      profiles!advisor_clients_client_id_fkey (
        id,
        full_name,
        email,
        subscription_status,
        created_at
      )
    `)
    .eq('advisor_id', user.id)
    .neq('status', 'removed')
    .order('invited_at', { ascending: false })

  // Fetch households for net worth calculation
  const clientIds = (advisorClients ?? [])
    .map(ac => ac.client_id)
    .filter(Boolean)

  const { data: households } = clientIds.length > 0
    ? await supabase
        .from('households')
        .select('owner_id')
        .in('owner_id', clientIds)
    : { data: [] }

  const { data: assets } = clientIds.length > 0
    ? await supabase
        .from('assets')
        .select('owner_id, value')
        .in('owner_id', clientIds)
    : { data: [] }

  const { data: liabilities } = clientIds.length > 0
    ? await supabase
        .from('liabilities')
        .select('owner_id, balance')
        .in('owner_id', clientIds)
    : { data: [] }

  const { data: advisorHousehold } = await supabase
    .from('households')
    .select('person1_name, person1_birth_year')
    .eq('owner_id', user.id)
    .maybeSingle()

  const showCompleteProfileBanner =
    !advisorHousehold ||
    !String(advisorHousehold.person1_name ?? '').trim() ||
    !advisorHousehold.person1_birth_year

  // Calculate net worth per client
  const netWorthMap: Record<string, number> = {}
  for (const clientId of clientIds) {
    const totalAssets = (assets ?? [])
      .filter(a => a.owner_id === clientId)
      .reduce((sum, a) => sum + Number(a.value), 0)
    const totalLiabilities = (liabilities ?? [])
      .filter(l => l.owner_id === clientId)
      .reduce((sum, l) => sum + Number(l.balance), 0)
    netWorthMap[clientId] = totalAssets - totalLiabilities
  }

  return (
    <AdvisorClient
      advisorClients={(advisorClients ?? []).map(ac => ({
        ...ac,
        profiles: Array.isArray(ac.profiles) ? ac.profiles[0] ?? null : ac.profiles,
      }))}
      netWorthMap={netWorthMap}
      advisorId={user.id}
      isFirmOwner={isFirmOwner}
      firm_name={firm_name}
      firm_id={firm_id}
      showCompleteProfileBanner={showCompleteProfileBanner}
    />
  )
}
