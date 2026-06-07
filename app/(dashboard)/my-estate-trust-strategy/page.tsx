import { getUserAccess } from '@/lib/get-user-access'
import { featureUpgradeTier, hasFeatureAccess } from '@/lib/tiers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import { loadUpgradeBannerHouseholdContext } from '@/lib/dashboard/upgradeBannerHouseholdContext'
import MyEstateTrustStrategyClient from './_client'
import { getCachedComposition } from '@/lib/estate/getCachedComposition'
import { requireMinimumViableProfile } from '@/lib/estate/requireMinimumProfile'
import { computeHeadroomBeforeFederalTax } from '@/lib/estate/exemptionLabels'
import {
  estimateTrustTaxSaved,
  marginalStateEstateRatePct,
} from '@/lib/trusts/trustEstateTaxEstimate'
import { loadTrustWillGuidance } from '@/lib/trusts/loadTrustWillGuidance'
import { computeFederalEstateTax, type EstateTaxBracket } from '@/lib/calculations/estate-tax'
import type { OutsideStrategyItem } from '@/lib/estate/types'
import type {
  EstateContext,
  InitialConsumerSavedState,
} from '@/components/consumer/ConsumerStrategyPanel'
import type { StrategyLineItemRow } from '@/lib/consumer/strategyLineItemViews'
import { buildStrategyHorizons, longevityAndSurvivor } from '@/lib/my-estate-strategy/horizonSnapshots'
import { deriveHasBypassTrustFromLineItems } from '@/lib/constants/strategyTypes'
import { latestFederalBracketsFromRows } from '@/lib/tax/federalExportTax'
import { displayPersonFirstName } from '@/lib/display-person-name'
import { getRmdStartAge } from '@/lib/calculations/rmdStartAge'
import { perRecipientLimitFromSplit } from '@/lib/gifting/perRecipientLimit'
import type { AnnualOutput } from '@/lib/types/projection-scenario'

function num(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v !== '') return Number(v) || 0
  return 0
}

function filingForTax(filingStatus: string | null | undefined): 'single' | 'married_joint' {
  const fs = filingStatus ?? ''
  if (fs === 'mfj' || fs === 'qw' || fs === 'married_filing_jointly' || fs === 'married_joint') {
    return 'married_joint'
  }
  return 'single'
}

function trustsExcludedSum(
  trusts: Array<{ excludes_from_estate?: boolean; excluded_from_estate?: unknown; funding_amount?: unknown }>,
): number {
  return trusts.reduce((s, t) => {
    if (t.excludes_from_estate === true) {
      return s + num(t.funding_amount ?? t.excluded_from_estate)
    }
    if (t.excludes_from_estate === false) return s
    return s + num(t.excluded_from_estate)
  }, 0)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export default async function MyEstateTrustStrategyPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const access = await getUserAccess()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!hasFeatureAccess('my-estate-trust-strategy', access.tier, access.isAdvisor, access.isTrial)) {
    const householdContext = await loadUpgradeBannerHouseholdContext(supabase, user.id)

    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-[color:var(--mwm-navy)]">My Estate & Trust Strategy</h1>
        <UpgradeBanner
          requiredTier={featureUpgradeTier('my-estate-trust-strategy')}
          moduleName="Gifting, Strategies & Trusts"
          valueProposition="Track gifting, charitable giving, and estate transfer strategies in one place."
          householdContext={householdContext}
        />
      </div>
    )
  }

  const { tab } = await searchParams

  const { data: householdRow } = await supabase
    .from('households')
    .select(
      'id, filing_status, person1_birth_year, person2_birth_year, person1_name, has_spouse, base_case_scenario_id, state_primary',
    )
    .eq('owner_id', user.id)
    .maybeSingle()

  requireMinimumViableProfile(householdRow, '/my-estate-trust-strategy')

  const { data: advisorRecommendations } = await supabase
    .from('strategy_configs')
    .select('strategy_type, label')
    .eq('household_id', householdRow.id)
    .eq('is_active', true)

  const [
    { data: liabilitiesRows },
    { data: federalBracketRows },
    { data: giftingSummaryData, error: giftingSummaryError },
    { data: giftHistoryRows },
    { data: advisorLineItemRows },
    { data: consumerLineItemRows },
    { data: withdrawnLineItemRows },
    { data: retirementAssetRows },
    { data: scenarioData },
    { data: stateBracketRows },
    { data: householdFull },
    { data: charitableSummaryData },
  ] = await Promise.all([
    supabase.from('liabilities').select('balance').eq('owner_id', user.id),
    supabase
      .from('federal_estate_tax_brackets')
      .select('tax_year, min_amount, max_amount, rate_pct')
      .order('tax_year', { ascending: false })
      .order('min_amount', { ascending: true }),
    supabase.rpc('calculate_gifting_summary', { p_household_id: householdRow.id }),
    supabase
      .from('gift_history')
      .select('recipient_name, amount, gift_type, form_709_filed')
      .eq('household_id', householdRow.id)
      .eq('tax_year', new Date().getFullYear()),
    supabase
      .from('strategy_line_items')
      .select('id, strategy_source, amount, sign, confidence_level, effective_year, metadata, scenario_name, consumer_accepted, consumer_rejected')
      .eq('household_id', householdRow.id)
      .eq('source_role', 'advisor')
      .eq('is_active', true),
    supabase
      .from('strategy_line_items')
      .select(
        'id, strategy_source, amount, sign, confidence_level, effective_year, metadata, scenario_name, consumer_withdrawn, consumer_status, consumer_accepted, consumer_rejected',
      )
      .eq('household_id', householdRow.id)
      .eq('source_role', 'consumer')
      .eq('is_active', true),
    supabase
      .from('strategy_line_items')
      .select(
        'id, strategy_source, amount, scenario_name, reversed_from, reversal_reason, withdrawn_at',
      )
      .eq('household_id', householdRow.id)
      .eq('consumer_withdrawn', true)
      .eq('is_active', false)
      .order('withdrawn_at', { ascending: false }),
    supabase
      .from('assets')
      .select('type, value, owner')
      .eq('owner_id', user.id)
      .in('type', ['traditional_ira', 'traditional_401k', 'sep_account', 'roth_ira', 'roth_401k']),
    supabase
      .from('projection_scenarios')
      .select('outputs_s1_first')
      .eq('id', householdRow.base_case_scenario_id ?? '')
      .single(),
    supabase
      .from('state_estate_tax_rules')
      .select('min_amount, max_amount, rate_pct, exemption_amount')
      .eq('state', householdRow.state_primary ?? '')
      .eq('tax_year', new Date().getFullYear())
      .order('min_amount', { ascending: true }),
    supabase
      .from('households')
      .select('person1_name, person2_name, person1_birth_year, person2_birth_year, person1_longevity_age, person2_longevity_age, has_spouse, filing_status, state_primary, base_case_scenario_id')
      .eq('owner_id', user.id)
      .single(),
    supabase.rpc('calculate_charitable_summary', { p_household_id: householdRow.id }),
  ])

  const lifetimeGiftsUsedForComposition = giftingSummaryError
    ? 0
    : Math.max(
        0,
        Number(
          (giftingSummaryData as { lifetime_exemption_used?: number } | null)?.lifetime_exemption_used ??
            0,
        ) || 0,
      )

  const composition = await getCachedComposition(
    supabase,
    householdRow.id,
    'consumer',
    lifetimeGiftsUsedForComposition,
  )

  const [trustWillGuidance, { data: checklistPersistedRows }] = await Promise.all([
    loadTrustWillGuidance(supabase, user.id, householdRow.id, composition),
    supabase
      .from('estate_checklist_items')
      .select('task_key, completed')
      .eq('household_id', householdRow.id),
  ])

  const persistedChecklist = Object.fromEntries(
    (checklistPersistedRows ?? []).map((row) => [row.task_key, row.completed]),
  )

  const strategyItems = (composition.outside_strategy_items ?? []) as OutsideStrategyItem[]
  const strategyReductionTotal = strategyItems
    .filter((s) => s.confidence_level !== 'illustrative')
    .reduce((sum, s) => sum + s.amount, 0)

  const totalLiabilities = (liabilitiesRows ?? []).reduce((sum, row) => sum + num(row.balance), 0)
  const trustsExcluded = trustsExcludedSum(trustWillGuidance.trusts)
  const federalBrackets = latestFederalBracketsFromRows(federalBracketRows ?? [])

  const filing = filingForTax(householdRow.filing_status)
  const grossEstate = num(composition.gross_estate)
  const taxWithoutStrategies =
    federalBrackets.length > 0 && grossEstate > 0
      ? computeFederalEstateTax(
          grossEstate,
          totalLiabilities,
          trustsExcluded,
          filing,
          federalBrackets,
          0,
          1,
        ).net_estate_tax
      : 0
  const taxWithStrategies =
    federalBrackets.length > 0 && grossEstate > 0
      ? computeFederalEstateTax(
          Math.max(0, grossEstate - strategyReductionTotal),
          totalLiabilities,
          trustsExcluded,
          filing,
          federalBrackets,
          0,
          1,
        ).net_estate_tax
      : 0
  // ── Estate context for ConsumerStrategyPanel ──────────────────────────────
  // Replaces hardcoded DEFAULT_GROSS_ESTATE and other constants in the panel.
  // Liquid/illiquid split from classifyEstateAssets composition
  const compositionValues = composition as Record<string, unknown>
  const insideLiquid = Number(compositionValues.inside_liquid ?? 0)
  const insideIlliquid = Number(compositionValues.inside_illiquid ?? 0)
  const insideRE = Number(compositionValues.inside_real_estate ?? 0)
  const insideBusiness = Number(compositionValues.inside_business_gross ?? 0)
  const liquidAssets = insideLiquid
  const illiquidAssets = insideIlliquid + insideRE + insideBusiness

  // Retirement asset balances from assets table
  const PRE_TAX_TYPES = ['traditional_ira', 'traditional_401k', 'sep_account']
  const ROTH_TYPES = ['roth_ira', 'roth_401k']

  const retirementAssets = retirementAssetRows ?? []
  const preIRABalance = retirementAssets
    .filter((a) => PRE_TAX_TYPES.includes(a.type))
    .reduce((s, a) => s + Number(a.value ?? 0), 0)
  const rothBalance = retirementAssets
    .filter((a) => ROTH_TYPES.includes(a.type))
    .reduce((s, a) => s + Number(a.value ?? 0), 0)

  // RMD calculation — IRS Uniform Lifetime Table approximation
  function getRMDFactor(age: number): number {
    // Simplified IRS Uniform Lifetime Table — factor decreases ~1 per year after 72
    return Math.max(1.0, 27.4 - (age - 72))
  }

  const p1BirthYear = householdRow.person1_birth_year ?? new Date().getFullYear() - 50
  const p1CurrentAge = new Date().getFullYear() - p1BirthYear
  const rmdStartAge = getRmdStartAge(p1BirthYear)
  const annualRMD =
    p1CurrentAge >= rmdStartAge && preIRABalance > 0
      ? Math.round(preIRABalance / getRMDFactor(p1CurrentAge))
      : 0

  const scenarioRows = (scenarioData?.outputs_s1_first ?? null) as AnnualOutput[] | null
  const stateBrackets = stateBracketRows ?? []
  const currentYear = new Date().getFullYear()
  const currentMonthYearLabel = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const { longevityAge, survivorIsPerson1 } = longevityAndSurvivor({
    hasSpouse: householdFull?.has_spouse ?? false,
    person1Longevity: householdFull?.person1_longevity_age,
    person2Longevity: householdFull?.person2_longevity_age,
  })
  const survivorFirstName = !householdFull?.has_spouse
    ? displayPersonFirstName(householdFull?.person1_name, 'You')
    : survivorIsPerson1
      ? displayPersonFirstName(householdFull?.person1_name, 'You')
      : displayPersonFirstName(householdFull?.person2_name, 'You')

  const advisorHorizonItems = (advisorLineItemRows ?? [])
    .filter((item) => !item.consumer_rejected)
    .map((item) => ({
      amount: Math.abs(Number(item.amount ?? 0)),
      confidence_level: item.confidence_level as 'certain' | 'probable' | 'illustrative',
      effective_year: item.effective_year,
      is_active: true,
      sign: typeof item.sign === 'number' ? item.sign : -1,
      strategy_source: String(item.strategy_source ?? ''),
      source_role: 'advisor' as const,
      consumer_accepted: Boolean(item.consumer_accepted),
    }))

  const consumerHorizonItems = (consumerLineItemRows ?? []).map((item) => ({
    amount: Math.abs(Number(item.amount ?? 0)),
    confidence_level: item.confidence_level as 'certain' | 'probable' | 'illustrative',
    effective_year: item.effective_year,
    is_active: true,
    sign: typeof item.sign === 'number' ? item.sign : -1,
    strategy_source: String(item.strategy_source ?? ''),
    source_role: 'consumer' as const,
    consumer_accepted: true,
  }))

  const horizonStrategyItems = [...consumerHorizonItems, ...advisorHorizonItems]
  const hasBypassTrust = deriveHasBypassTrustFromLineItems(horizonStrategyItems, 'consumer_accepted')

  const lifetimeGiftsUsed = giftingSummaryError
    ? 0
    : Math.max(
        0,
        Number((giftingSummaryData as { lifetime_exemption_used?: number } | null)?.lifetime_exemption_used ?? 0) ||
          0,
      )

  const advisorHorizons = householdFull ? buildStrategyHorizons({
    currentYear,
    currentMonthYearLabel,
    liveNetWorth: grossEstate,
    strategyLineItems: horizonStrategyItems,
    stateBrackets,
    federalBrackets,
    lifetimeGiftsUsed,
    household: {
      state_primary: householdFull.state_primary,
      filing_status: householdFull.filing_status,
      has_spouse: householdFull.has_spouse,
      person1_name: householdFull.person1_name,
      person2_name: householdFull.person2_name,
      person1_birth_year: householdFull.person1_birth_year,
      person2_birth_year: householdFull.person2_birth_year,
      person1_longevity_age: householdFull.person1_longevity_age,
      person2_longevity_age: householdFull.person2_longevity_age,
    },
    scenarioRows,
    survivorFirstName,
    longevityAge,
    hasBypassTrust,
  }) : null

  const hasHorizonFederalContext =
    isFiniteNumber(advisorHorizons?.today.federalExemption) &&
    isFiniteNumber(advisorHorizons?.today.federalTaxEstimate)

  if (!hasHorizonFederalContext) {
    console.error('[horizon-input-missing]', {
      ts: new Date().toISOString(),
      surface: 'consumer_trust_strategy_context',
      householdId: householdRow.id,
      missingFields: [
        !isFiniteNumber(advisorHorizons?.today.federalExemption) ? 'today.federalExemption' : null,
        !isFiniteNumber(advisorHorizons?.today.federalTaxEstimate) ? 'today.federalTaxEstimate' : null,
      ].filter(Boolean),
    })
  }

  // Enforce horizon-only federal parity context (no fallback substitution).
  const federalExemptionForContext = hasHorizonFederalContext
    ? Number(advisorHorizons?.today.federalExemption)
    : 0

  const estimatedFederalTaxForContext = hasHorizonFederalContext
    ? Number(advisorHorizons?.today.federalTaxEstimate)
    : 0

  const estateContext: EstateContext = {
    grossEstate: grossEstate,
    federalExemption: federalExemptionForContext,
    estimatedFederalTax: estimatedFederalTaxForContext,
    // `calculate_estate_composition` (via classifyEstateAssets) returns `estimated_tax_state`
    estimatedStateTax: Number(compositionValues.estimated_tax_state ?? 0),
    person1BirthYear: p1BirthYear,
    liquidAssets,
    illiquidAssets,
    preIRABalance,
    rothBalance,
    annualRMD,
  }

  const currentTaxYear = new Date().getFullYear()
  const initialGiftingSummary = giftingSummaryError ? null : (giftingSummaryData ?? null)
  const giftingData = giftingSummaryError
    ? null
    : (giftingSummaryData as
        | {
            annual_used?: number
            annual_remaining?: number
            tax_year?: number
            per_recipient_limit?: number
          }
        | null)
  const giftingTaxYear = giftingData?.tax_year ?? currentTaxYear
  const giftRows = (giftHistoryRows ?? []) as Array<{
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

  const outsideStrategyTotal = Number(composition.outside_strategy_total ?? 0)
  const exemptionAvailable = Number(composition.exemption_available ?? 0)
  const headroom = computeHeadroomBeforeFederalTax(
    exemptionAvailable,
    grossEstate,
    outsideStrategyTotal,
  )
  const federalExemptionRemaining = Math.max(
    0,
    exemptionAvailable - lifetimeGiftsUsedForComposition,
  )

  const stateCode = (householdRow.state_primary ?? '').toUpperCase()
  const latestStateTaxYear = Math.max(
    ...(stateBrackets ?? []).map((b) => num((b as { tax_year?: unknown }).tax_year)),
    0,
  )
  const stateRulesForMarginal = (stateBrackets ?? [])
    .filter(
      (b) =>
        String((b as { state?: string }).state ?? '').toUpperCase() === stateCode &&
        num((b as { tax_year?: unknown }).tax_year) === latestStateTaxYear,
    )
    .map((b) => ({
      min_amount: num((b as { min_amount?: unknown }).min_amount),
      max_amount:
        (b as { max_amount?: unknown }).max_amount != null
          ? num((b as { max_amount?: unknown }).max_amount)
          : null,
      rate_pct: num((b as { rate_pct?: unknown }).rate_pct),
    }))
  const marginalStateEstateRate = marginalStateEstateRatePct(stateRulesForMarginal, grossEstate)

  const trustEstateSummary = {
    estimatedTaxableEstate: Number(composition.taxable_estate ?? grossEstate),
    federalExemptionRemaining,
    lifetimeGiftsUsed: lifetimeGiftsUsedForComposition,
    headroom,
  }

  const mapActiveStrategyRow = (
    row: {
      id: string
      strategy_source: string
      confidence_level: string
      amount: unknown
      scenario_name?: string | null
      consumer_accepted?: boolean | null
      consumer_rejected?: boolean | null
      effective_year?: number | null
    },
    sourceRole: 'advisor' | 'consumer',
  ): StrategyLineItemRow => ({
    id: row.id,
    strategy_source: row.strategy_source,
    source_role: sourceRole,
    confidence_level: row.confidence_level,
    amount: row.amount != null ? Number(row.amount) : null,
    scenario_name: row.scenario_name ?? null,
    consumer_accepted: Boolean(row.consumer_accepted),
    consumer_rejected: Boolean(row.consumer_rejected),
    effective_year: row.effective_year ?? null,
  })

  const initialStrategyRows: StrategyLineItemRow[] = [
    ...(advisorLineItemRows ?? []).map((row) => mapActiveStrategyRow(row, 'advisor')),
    ...(consumerLineItemRows ?? []).map((row) => mapActiveStrategyRow(row, 'consumer')),
  ]

  const initialWithdrawnRows = (withdrawnLineItemRows ?? []).map((row) => ({
    id: row.id as string,
    strategy_source: row.strategy_source as string,
    amount: row.amount != null ? Number(row.amount) : null,
    scenario_name: (row.scenario_name as string | null) ?? null,
    reversed_from: (row.reversed_from as string | null) ?? null,
    reversal_reason: (row.reversal_reason as string | null) ?? null,
    withdrawn_at: (row.withdrawn_at as string | null) ?? null,
  }))

  const initialConsumerSaved: InitialConsumerSavedState = {
    savedSources: (consumerLineItemRows ?? []).map((row) => row.strategy_source as string),
    statuses: Object.fromEntries(
      (consumerLineItemRows ?? []).map((row) => [
        row.strategy_source as string,
        ((row.consumer_status as string | null) ?? 'not_started') as
          | 'not_started'
          | 'in_progress'
          | 'complete',
      ]),
    ),
    savedDetails: Object.fromEntries(
      (consumerLineItemRows ?? []).map((row) => [
        row.strategy_source as string,
        {
          amount: Number(row.amount ?? 0),
          metadata: (row.metadata as Record<string, unknown> | null) ?? null,
        },
      ]),
    ),
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {!hasHorizonFederalContext && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Federal horizon inputs are missing, so federal estimates are temporarily unavailable on this page.
          Regenerate your base-case projection to restore horizon-driven federal values.
        </div>
      )}
      <MyEstateTrustStrategyClient
        householdId={householdRow.id}
        ownerUserId={user.id}
        userRole={access.isAdvisor ? 'advisor' : 'consumer'}
        consumerTier={access.tier}
        initialTab={tab ?? 'gifting'}
        advisorRecommendations={advisorRecommendations ?? []}
        advisorLineItems={advisorLineItemRows ?? []}
        consumerLineItems={consumerLineItemRows ?? []}
        advisorHorizons={advisorHorizons}
        federalBrackets={federalBrackets}
        stateBrackets={stateBrackets}
        filingStatus={householdFull?.filing_status}
        hasSpouse={householdFull?.has_spouse ?? false}
        hasBypassTrust={hasBypassTrust}
        statePrimary={householdFull?.state_primary}
        estateContext={estateContext}
        strategyImpact={{
          strategyItems,
          strategyReductionTotal,
          taxWithoutStrategies,
          taxWithStrategies,
          taxSavings: Math.max(0, taxWithoutStrategies - taxWithStrategies),
        }}
        giftingScenario={{
          filing,
          giftingAnnualUsed:
            qualifyingAnnualGifts > 0
              ? qualifyingAnnualGifts
              : (giftingData?.annual_used ?? null),
          giftingAnnualRemaining: giftingData?.annual_remaining ?? null,
          giftingAnnualLoggedTotal: annualLoggedTotal || null,
          giftingTaxYear,
          giftingSplitSelected: splitSelected,
          giftingPerRecipientLimit: perRecipientLimit,
          giftingExcessOverLimit: excessAnnualGifts || null,
        }}
        initialGiftingSummary={initialGiftingSummary}
        trustWillGuidance={{
          estateValue: trustWillGuidance.estateValue,
          recommendations: trustWillGuidance.recommendations,
          checklist: trustWillGuidance.checklist,
          trusts: trustWillGuidance.trusts,
        }}
        trustEstateSummary={trustEstateSummary}
        marginalStateEstateRatePct={marginalStateEstateRate}
        charitableHouseholdContext={{
          statePrimary: householdRow.state_primary ?? null,
          filingStatus: householdRow.filing_status ?? null,
          person1BirthYear: householdRow.person1_birth_year ?? null,
          person2BirthYear: householdRow.person2_birth_year ?? null,
          hasSpouse: householdRow.has_spouse ?? false,
          person1Name: householdRow.person1_name ?? null,
          preIraBalance: estateContext.preIRABalance,
        }}
        initialCharitableSummary={charitableSummaryData ?? null}
        initialStrategyRows={initialStrategyRows}
        initialWithdrawnRows={initialWithdrawnRows}
        initialConsumerSaved={initialConsumerSaved}
        persistedChecklist={persistedChecklist}
      />
    </div>
  )
}
