/**
 * Advisor home page (server) for client roster management.
 *
 * Loads advisor-linked clients plus household/health/net-worth context and passes
 * hydrated data into the advisor client workspace UI.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { buildAllEventReferralUrls } from '@/lib/events/referral'
import { loadRosterNetWorthByOwner } from '@/lib/roster/rosterNetWorth'
import { loadRosterAlertCounts } from '@/lib/advisor/rosterAlertCounts'
import { ADVISOR_FIRM_PRICE_IDS } from '@/lib/tiers'
import AdvisorClient from './_advisor-client-wrapper'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureAdvisorActivationDripStep1 } from '@/lib/advisor/sendAdvisorDripStep'

export default async function AdvisorPage() {
  const access = await getAccessContext()
  if (!access.user) redirect('/login')
  const user = { id: access.user.id, email: access.user.email }

  void ensureAdvisorActivationDripStep1(createAdminClient(), user.id).catch((err) => {
    console.error('advisor drip step 1 on portal visit:', err)
  })

  const supabase = await createClient()
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

  const [{ data: households }, { data: advisorListing }] = await Promise.all([
    clientIds.length > 0
      ? supabase.from('households').select('id, owner_id').in('owner_id', clientIds)
      : Promise.resolve({ data: [] as { id: string; owner_id: string }[] }),
    supabase
      .from('advisor_directory')
      .select('referral_code')
      .eq('profile_id', user.id)
      .maybeSingle(),
  ])

  // Build household_id lookup: owner_id -> household_id
  const ownerToHousehold: Record<string, string> = {}
  for (const h of households ?? []) {
    ownerToHousehold[h.owner_id] = h.id
  }

  const householdIds = Object.values(ownerToHousehold)

  const [{ data: healthScores }, netWorthMap, alertCountsMap] = await Promise.all([
    householdIds.length > 0
      ? supabase
          .from('estate_health_scores')
          .select('household_id, score')
          .in('household_id', householdIds)
      : Promise.resolve({ data: [] as { household_id: string; score: number }[] }),
    loadRosterNetWorthByOwner(supabase, clientIds),
    loadRosterAlertCounts(supabase, householdIds),
  ])

  const healthScoreMap: Record<string, number> = {}
  for (const hs of healthScores ?? []) {
    const ownerId = Object.entries(ownerToHousehold).find(([, hid]) => hid === hs.household_id)?.[0]
    if (ownerId) healthScoreMap[ownerId] = hs.score
  }

  const referralCode = advisorListing?.referral_code ?? null
  const eventReferralUrls = referralCode
    ? buildAllEventReferralUrls(referralCode)
    : null

  const firmTierKey = access.firm_tier ?? 'starter'
  const firmCheckoutPriceId =
    ADVISOR_FIRM_PRICE_IDS[firmTierKey as keyof typeof ADVISOR_FIRM_PRICE_IDS] ||
    ADVISOR_FIRM_PRICE_IDS.starter

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
      firmCheckoutPriceId={firmCheckoutPriceId || null}
      healthScoreMap={healthScoreMap}
      householdIdMap={ownerToHousehold}
      alertCountsMap={alertCountsMap}
      referralCode={referralCode}
      eventReferralUrls={eventReferralUrls}
    />
  )
}
