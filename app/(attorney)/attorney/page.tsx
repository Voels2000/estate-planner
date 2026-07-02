import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AttorneyDashboardClient } from './_attorney-dashboard-client'
import { resolveAttorneyTierFeatures } from '@/lib/attorney/attorneyTierLimits'
import { ensureAttorneyActivationDripStep1 } from '@/lib/attorney/sendAttorneyDripStep'
import { createAdminClient } from '@/lib/supabase/admin'
import { countDocumentsOnFile, countOpenDocumentGaps, summarizeMissingDocs } from '@/lib/attorney/clientDocHealth'
import { loadRosterNetWorthByOwner } from '@/lib/roster/rosterNetWorth'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { attorneyConnectedHouseholds } from '@/lib/billing/connectedHouseholdCount'
import { buildAttorneyConnectionBillingSummary } from '@/lib/billing/attorneyConnectionBillingSummary'

type AttorneyClientRow = {
  id: string
  client_id: string
  status: string
  granted_at: string | null
  advisor_pdf_access: boolean | null
  matter_stage: string | null
  client_status: string | null
}

type AttorneyHouseholdRow = {
  id: string
  name: string | null
  person1_first_name: string | null
  person1_last_name: string | null
  person2_first_name: string | null
  person2_last_name: string | null
  state_primary: string | null
  estate_complexity_flag: string | null
  owner_id: string
}

type OwnerProfileRow = {
  id: string
  full_name: string | null
  email: string | null
}

function resolveClientDisplayName(
  owner: OwnerProfileRow | undefined,
  household: AttorneyHouseholdRow | undefined,
): string {
  const profileName = owner?.full_name?.trim()
  if (profileName) return profileName
  const personName = [household?.person1_first_name, household?.person1_last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
  if (personName) return personName
  const householdName = household?.name?.trim()
  if (householdName) return householdName
  return 'Unknown Client'
}

type LegalDocumentCountRow = {
  household_id: string
  document_type: string
  is_current: boolean
  is_deleted: boolean
}

export default async function AttorneyDashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  void ensureAttorneyActivationDripStep1(createAdminClient(), user.id).catch((err) => {
    console.error('attorney drip step 1:', err instanceof Error ? err.message : err)
  })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, attorney_tier')
    .eq('id', user.id)
    .single()
  const { data: attorneyListing } = await supabase
    .from('attorney_listings')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  // 4. Fetch all active clients using the listing ID
  const { data: clients } = attorneyListing
    ? await supabase
        .from('attorney_clients')
        .select(`
          id,
          client_id,
          status,
          granted_at,
          advisor_pdf_access,
          matter_stage,
          client_status
        `)
        .eq('attorney_id', attorneyListing.id)
        .in('status', ['active', 'accepted'])
        .order('granted_at', { ascending: false })
    : { data: [] }

  // 5. Fetch household details for each client
  const tierFeatures = resolveAttorneyTierFeatures(profile?.attorney_tier ?? 0)
  const clientRows = (clients ?? []) as AttorneyClientRow[]
  const visibleClients =
    tierFeatures.maxClients >= Number.MAX_SAFE_INTEGER / 2
      ? clientRows
      : clientRows.slice(0, tierFeatures.maxClients)

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
    : { data: [] as AttorneyHouseholdRow[] }

  // 6. Fetch owner profiles for each household
  const householdRows = (households ?? []) as AttorneyHouseholdRow[]
  const ownerIds = householdRows.map((h) => h.owner_id).filter(Boolean)

  const { data: ownerProfiles } = ownerIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ownerIds)
    : { data: [] as OwnerProfileRow[] }

  const [{ data: docCounts }, netWorthMap] = await Promise.all([
    householdIds.length > 0
      ? supabase
          .from('legal_documents')
          .select('household_id, document_type, is_current, is_deleted')
          .in('household_id', householdIds)
          .eq('is_current', true)
          .eq('is_deleted', false)
      : Promise.resolve({ data: [] as LegalDocumentCountRow[] }),
    loadRosterNetWorthByOwner(supabase, ownerIds),
  ])

  const ownerProfileRows = (ownerProfiles ?? []) as OwnerProfileRow[]
  const docCountRows = (docCounts ?? []) as LegalDocumentCountRow[]

  let documentGapsTotal = 0

  const clientCards = visibleClients.map((client) => {
    const household = householdRows.find((h) => h.id === client.client_id)
    const owner = ownerProfileRows.find((p) => p.id === household?.owner_id)
    const clientDocs = docCountRows.filter((d) => d.household_id === client.client_id)
    documentGapsTotal += countOpenDocumentGaps(clientDocs)
    const docHealth = countDocumentsOnFile(clientDocs)
    const ownerId = household?.owner_id
    const rosterNetWorth = ownerId ? (netWorthMap[ownerId] ?? 0) : 0

    return {
      connection_id: client.id,
      household_id: client.client_id,
      granted_at: client.granted_at,
      advisor_pdf_access: client.advisor_pdf_access === true,
      full_name: resolveClientDisplayName(owner, household),
      email: owner?.email ?? '',
      household_name: household?.name ?? '',
      state: household?.state_primary ?? '',
      complexity_flag: household?.estate_complexity_flag ?? '',
      doc_count: clientDocs.length,
      docs_on_file: docHealth.onFile,
      docs_total: docHealth.total,
      missing_docs: summarizeMissingDocs(clientDocs),
      roster_net_worth: rosterNetWorth,
      last_updated: client.granted_at,
      matter_stage: client.matter_stage ?? 'intake',
      client_status: client.client_status ?? 'active',
    }
  })

  const connectionBillingEnabled = isConnectionBillingEnabled()
  let connectionBillingSummary = null
  if (connectionBillingEnabled && attorneyListing) {
    const admin = createAdminClient()
    const connectedCount = await attorneyConnectedHouseholds(admin, attorneyListing.id)
    const { data: listingBilling } = await admin
      .from('attorney_listings')
      .select('client_limit, billing_floor, reset_count')
      .eq('id', attorneyListing.id)
      .single()
    connectionBillingSummary = buildAttorneyConnectionBillingSummary({
      connectedCount,
      clientLimit: listingBilling?.client_limit,
      billingFloor: listingBilling?.billing_floor,
      resetCount: listingBilling?.reset_count,
    })
  }

  return (
    <AttorneyDashboardClient
      attorneyName={profile?.full_name ?? 'Attorney'}
      clients={clientCards}
      showDocHealth={clientCards.length > 0}
      attorneyTier={profile?.attorney_tier ?? 0}
      clientLimit={tierFeatures.maxClients}
      totalClients={clientRows.length}
      connectionBillingEnabled={connectionBillingEnabled}
      connectionBillingSummary={connectionBillingSummary}
      documentGapsTotal={documentGapsTotal}
    />
  )
}
