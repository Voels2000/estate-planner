import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AttorneyDashboardClient } from './_attorney-dashboard-client'
import { buildAllAttorneyEventReferralUrls } from '@/lib/events/referral'
import { attorneyTierFeatures } from '@/lib/attorney/attorneyTierLimits'
import { countDocumentsOnFile, summarizeMissingDocs } from '@/lib/attorney/clientDocHealth'

export default async function AttorneyDashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, attorney_tier')
    .eq('id', user.id)
    .single()
  const { data: attorneyListing } = await supabase
    .from('attorney_listings')
    .select('id, referral_code')
    .eq('profile_id', user.id)
    .maybeSingle()

  const referralCode = attorneyListing?.referral_code ?? null
  const eventReferralUrls = referralCode
    ? buildAllAttorneyEventReferralUrls(referralCode)
    : null

  // 4. Fetch all active clients using the listing ID
  const { data: clients } = attorneyListing
    ? await supabase
        .from('attorney_clients')
        .select(`
          id,
          client_id,
          status,
          granted_at,
          advisor_pdf_access
        `)
        .eq('attorney_id', attorneyListing.id)
        .in('status', ['active', 'accepted'])
        .order('granted_at', { ascending: false })
    : { data: [] }

  // 5. Fetch household details for each client
  const tierFeatures = attorneyTierFeatures(profile?.attorney_tier ?? 0)
  const visibleClients = (clients ?? []).slice(0, tierFeatures.maxClients)

  const householdIds = visibleClients.map((c) => c.client_id).filter(Boolean)

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

  // 6. Fetch owner profiles for each household
  const ownerIds = (households ?? []).map(h => h.owner_id).filter(Boolean)

  const { data: ownerProfiles } = ownerIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ownerIds)
    : { data: [] }

  // 7. Fetch document counts per household
  const { data: docCounts } = householdIds.length > 0
    ? await supabase
        .from('legal_documents')
        .select('household_id, document_type, is_current, is_deleted')
        .in('household_id', householdIds)
        .eq('is_current', true)
        .eq('is_deleted', false)
    : { data: [] }

  const { data: assetTotals } = ownerIds.length > 0
    ? await supabase.from('assets').select('owner_id, value').in('owner_id', ownerIds)
    : { data: [] }
  const { data: reTotals } = ownerIds.length > 0
    ? await supabase.from('real_estate').select('owner_id, current_value').in('owner_id', ownerIds)
    : { data: [] }

  const clientCards = visibleClients.map((client) => {
    const household = (households ?? []).find((h) => h.id === client.client_id)
    const owner = (ownerProfiles ?? []).find((p) => p.id === household?.owner_id)
    const clientDocs = (docCounts ?? []).filter((d) => d.household_id === client.client_id)
    const docHealth = countDocumentsOnFile(clientDocs)
    const ownerId = household?.owner_id
    const estateValue =
      (assetTotals ?? [])
        .filter((a) => a.owner_id === ownerId)
        .reduce((s, a) => s + Number(a.value ?? 0), 0) +
      (reTotals ?? [])
        .filter((r) => r.owner_id === ownerId)
        .reduce((s, r) => s + Number(r.current_value ?? 0), 0)

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
      doc_count: clientDocs.length,
      docs_on_file: docHealth.onFile,
      docs_total: docHealth.total,
      missing_docs: summarizeMissingDocs(clientDocs),
      estate_value: estateValue,
      last_updated: client.granted_at,
    }
  })

  return (
    <AttorneyDashboardClient
      attorneyName={profile?.full_name ?? 'Attorney'}
      clients={clientCards}
      referralCode={referralCode}
      eventReferralUrls={eventReferralUrls}
      showDocHealth={tierFeatures.multiClientDocDashboard}
      attorneyTier={profile?.attorney_tier ?? 0}
      clientLimit={tierFeatures.maxClients}
      totalClients={(clients ?? []).length}
    />
  )
}
