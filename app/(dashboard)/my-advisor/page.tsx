import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MyAdvisorClient from './_my-advisor-client'

export default async function MyAdvisorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Find active advisor connection
  const { data: connection } = await supabase
    .from('advisor_clients')
    .select(`
      id,
      status,
      accepted_at,
      advisor_id,
      profiles!advisor_clients_advisor_id_fkey (
        id,
        full_name,
        email
      )
    `)
    .eq('client_id', user.id)
    .eq('status', 'accepted')
    .maybeSingle()

  // Try to get advisor listing details
  const advisorId = connection?.advisor_id ?? null
  const { data: listing } = advisorId
    ? await supabase
        .from('advisor_listings')
        .select('firm_name, city, state, bio, credentials, specializations, is_fiduciary, website')
        .eq('advisor_id', advisorId)
        .maybeSingle()
    : { data: null }

  // Fetch access log — last 5 times advisor viewed their data
  const { data: accessLog } = await supabase
    .from('advisor_access_log')
    .select('accessed_at, page')
    .eq('client_id', user.id)
    .order('accessed_at', { ascending: false })
    .limit(5)

  return (
    <MyAdvisorClient
      connection={connection ?? null}
      listing={listing ?? null}
      accessLog={accessLog ?? []}
    />
  )
}
