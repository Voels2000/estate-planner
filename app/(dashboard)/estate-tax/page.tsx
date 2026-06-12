import { getUserAccess } from '@/lib/get-user-access'
import { featureUpgradeTier, hasFeatureAccess } from '@/lib/tiers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import EstateTaxClient, { type EstateTaxTrustRow } from './_estate-tax-client'
import { getCachedComposition } from '@/lib/estate/getCachedComposition'
import { requireMinimumViableProfile } from '@/lib/estate/requireMinimumProfile'
import { createAdminClient } from '@/lib/supabase/admin'
import { strategyLabel } from '@/lib/strategy/strategyLabels'
import { loadScenarioMonteCarloWithStaleness } from '@/lib/monte-carlo/loadScenarioMonteCarloWithStaleness'
import { perRecipientLimitFromSplit } from '@/lib/gifting/perRecipientLimit'
import { loadScopedEstateTaxReferenceData } from '@/lib/tax/loadScopedEstateTaxReferenceData'

export default async function EstateTaxPage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: householdRow } = await supabase
    .from('households')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!hasFeatureAccess('estate-tax', access.tier, access.isAdvisor, access.isTrial)) {
    let grossEstate: number | null = null
    let estimatedTaxState: number | null = null
    let estimatedTaxFederal: number | null = null
    let topConflict: string | null = null

    if (householdRow?.id) {
      const compositionForBanner = await getCachedComposition(
        supabase,
        householdRow.id,
        'consumer',
        0,
      )
      grossEstate = compositionForBanner.gross_estate ?? null
      estimatedTaxState = compositionForBanner.estimated_tax_state ?? null
      estimatedTaxFederal = compositionForBanner.estimated_tax_federal ?? null

      const admin = createAdminClient()
      const { data: conflictRows } = await admin
        .from('beneficiary_conflicts')
        .select('description, severity')
        .eq('household_id', householdRow.id)

      if (conflictRows && conflictRows.length > 0) {
        const severityRank = (s: string | null) =>
          s === 'critical' ? 0 : s === 'warning' ? 1 : 2
        const sorted = [...conflictRows].sort(
          (a, b) => severityRank(a.severity) - severityRank(b.severity),
        )
        topConflict = sorted[0]?.description ?? null
      }
    }

    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-[color:var(--mwm-navy)]">Estate Tax Snapshot</h1>
        <UpgradeBanner
          requiredTier={featureUpgradeTier('estate-tax')}
          moduleName="Estate Tax Snapshot"
          valueProposition="See exactly how your estate tax is calculated, what's driving it, and how much headroom you have before federal tax kicks in."
          ctaLabel="See your estate tax breakdown →"
          householdContext={{
            grossEstate,
            estimatedTaxState,
            estimatedTaxFederal,
            topConflict,
            statePrimary: householdRow?.state_primary ?? null,
            firstName: null,
          }}
        />
      </div>
    )
  }

  const [
    { data: liabilitiesRows },
    { data: trustsRows },
    taxReferenceData,
  ] = await Promise.all([
    supabase
      .from('liabilities')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('trusts')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    loadScopedEstateTaxReferenceData(supabase, householdRow?.state_primary),
  ])
  const {
    federalEstateTaxBracketsRows,
    stateEstateTaxRows,
    stateInheritanceTaxRows,
  } = taxReferenceData

  requireMinimumViableProfile(householdRow, '/estate-tax')

  const giftingSummary =
    householdRow?.id != null
      ? await supabase.rpc('calculate_gifting_summary', {
          p_household_id: householdRow.id,
        })
      : { data: null }

  const currentTaxYear = new Date().getFullYear()
  const giftingData = giftingSummary.data as
    | {
        annual_capacity?: number
        annual_used?: number
        annual_remaining?: number
        tax_year?: number
        per_recipient_limit?: number
      }
    | null
  const giftingTaxYear = giftingData?.tax_year ?? currentTaxYear

  const giftRowsResult =
    householdRow?.id != null
      ? await supabase
          .from('gift_history')
          .select('recipient_name, amount, gift_type, form_709_filed')
          .eq('household_id', householdRow.id)
          .eq('tax_year', giftingTaxYear)
      : { data: null }

  const giftRows = (giftRowsResult.data ?? []) as Array<{
    recipient_name: string | null
    amount: number | null
    gift_type: string | null
    form_709_filed: boolean | null
  }>
  const splitSelected = giftRows.some((r) => r.form_709_filed === true)
  const perRecipientLimit = perRecipientLimitFromSplit(
    splitSelected,
    giftingData?.per_recipient_limit ?? null,
  )

  const recipientGiftTotals = new Map<string, number>()
  for (const row of giftRows) {
    if ((row.gift_type ?? 'annual') !== 'annual') continue
    const recipientKey = (row.recipient_name ?? 'Unnamed recipient').trim().toLowerCase()
    const amount = Number(row.amount ?? 0)
    recipientGiftTotals.set(recipientKey, (recipientGiftTotals.get(recipientKey) ?? 0) + amount)
  }

  let qualifyingAnnualGifts = 0
  let excessAnnualGifts = 0
  let annualLoggedTotal = 0
  for (const row of giftRows) {
    if ((row.gift_type ?? 'annual') !== 'annual') continue
    annualLoggedTotal += Number(row.amount ?? 0)
  }
  recipientGiftTotals.forEach((total) => {
    const qualifying = Math.min(Math.max(0, total), perRecipientLimit)
    qualifyingAnnualGifts += qualifying
    excessAnnualGifts += Math.max(0, total - perRecipientLimit)
  })

  // ── Estate composition — correct gross estate from RPC ──────────────────────
  // Fetched server-side so the client component has it immediately without
  // a loading state. Falls back gracefully if household has no data.
  const lifetimeGiftsUsed = Math.max(
    0,
    Number(
      (giftingSummary.data as { lifetime_exemption_used?: number } | null)?.lifetime_exemption_used ??
        0,
    ) || 0,
  )

  const composition = householdRow?.id
    ? await getCachedComposition(supabase, householdRow.id, 'consumer', lifetimeGiftsUsed)
    : null

  const { data: strategyLineRows } = householdRow?.id
    ? await supabase
        .from('strategy_line_items')
        .select(
          'id, strategy_source, amount, sign, scenario_name, is_active, consumer_accepted, consumer_rejected, source_role',
        )
        .eq('household_id', householdRow.id)
        .eq('is_active', true)
        .is('projection_year', null)
    : { data: null }

  const strategyLineItems = (strategyLineRows ?? [])
    .filter((row) => !row.consumer_rejected)
    .filter(
      (row) =>
        row.source_role === 'consumer' ||
        (row.source_role === 'advisor' && row.consumer_accepted),
    )
    .map((row) => ({
      id: String(row.id),
      strategy_type: String(row.strategy_source ?? 'other'),
      strategy_label: strategyLabel(String(row.strategy_source ?? 'other'), row.scenario_name),
      estimated_exclusion: Math.abs(Number(row.amount ?? 0)),
    }))

  const statePrimaryUpper = String(householdRow?.state_primary ?? '')
    .trim()
    .toUpperCase()
  const noPortability = (stateEstateTaxRows ?? []).some(
    (row) =>
      String(row.state ?? '')
        .trim()
        .toUpperCase() === statePrimaryUpper && row.no_portability === true,
  )

  const baseCaseScenarioId =
    householdRow != null
      ? (householdRow as { base_case_scenario_id?: string | null }).base_case_scenario_id
      : null
  const mcLoad =
    householdRow?.id && baseCaseScenarioId
      ? await loadScenarioMonteCarloWithStaleness(supabase, {
          householdId: householdRow.id,
          scenarioId: String(baseCaseScenarioId),
        })
      : { summary: null, isStale: false, isUpdating: false }
  const mcData = mcLoad.summary

  return (
    <>
      <EstateTaxClient
        liabilities={liabilitiesRows ?? []}
        trusts={(trustsRows ?? []) as EstateTaxTrustRow[]}
        household={householdRow as Record<string, unknown> | null}
        brackets={federalEstateTaxBracketsRows ?? []}
        stateEstateTaxRules={stateEstateTaxRows ?? []}
        stateInheritanceTaxRules={stateInheritanceTaxRows ?? []}
        giftingAnnualCapacity={giftingData?.annual_capacity ?? null}
        giftingAnnualUsed={qualifyingAnnualGifts}
        giftingAnnualRemaining={giftingData?.annual_remaining ?? null}
        giftingAnnualLoggedTotal={annualLoggedTotal}
        giftingTaxYear={giftingTaxYear}
        giftingSplitSelected={splitSelected}
        giftingPerRecipientLimit={perRecipientLimit}
        giftingExcessOverLimit={excessAnnualGifts}
        composition={composition}
        strategyLineItems={strategyLineItems}
        noPortability={noPortability}
        waThresholdToday={mcData?.wa_threshold_prob_by_year?.[0] ?? null}
        mcUpdating={mcLoad.isUpdating}
      />
    </>
  )
}
