import { getUserAccess } from '@/lib/get-user-access'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import MyEstateTrustStrategyClient from './_client'
import { classifyEstateAssets } from '@/lib/estate/classifyEstateAssets'
import { computeFederalEstateTax, type EstateTaxBracket } from '@/lib/calculations/estate-tax'
import type { OutsideStrategyItem } from '@/lib/estate/types'
import type { EstateContext } from '@/components/consumer/ConsumerStrategyPanel'

const ADVISOR_STRATEGY_LABELS: Record<string, string> = {
  gifting: 'Annual Gifting Program',
  revocable_trust: 'Revocable Living Trust',
  credit_shelter_trust: 'Credit Shelter Trust (CST)',
  grat: 'Grantor Retained Annuity Trust (GRAT)',
  crt: 'Charitable Remainder Trust (CRT)',
  clat: 'Charitable Lead Annuity Trust (CLAT)',
  daf: 'Donor Advised Fund (DAF)',
  roth: 'Roth Conversion',
  liquidity: 'Estate Liquidity Planning',
}

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

export default async function MyEstateTrustStrategyPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const access = await getUserAccess()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (access.tier < 3) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">My Estate & Trust Strategy</h1>
        <UpgradeBanner
          requiredTier={3}
          moduleName="Gifting, Strategies & Trusts"
          valueProposition="Track gifting, charitable giving, and estate transfer strategies in one place."
        />
      </div>
    )
  }

  const { data: householdRow } = await supabase
    .from('households')
    .select('id, filing_status, person1_birth_year')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!householdRow?.id) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <p className="text-sm text-neutral-500">No household found. Please complete your profile first.</p>
      </div>
    )
  }

  const { data: advisorRecommendations } = await supabase
    .from('strategy_configs')
    .select('strategy_type, label')
    .eq('household_id', householdRow.id)
    .eq('is_active', true)

  // Create one in-app notification per newly added advisor recommendation.
  const recommendationRows = advisorRecommendations ?? []
  const { data: existingRecommendationNotifs } = await supabase
    .from('notifications')
    .select('metadata')
    .eq('user_id', user.id)
    .eq('type', 'advisor_strategy_recommended')

  const alreadyNotified = new Set<string>(
    (existingRecommendationNotifs ?? [])
      .map((row) => {
        const strategyType = row.metadata?.strategy_type
        return typeof strategyType === 'string' ? strategyType : null
      })
      .filter((value): value is string => value !== null),
  )

  const newRecommendationNotifs = recommendationRows
    .filter((row) => !alreadyNotified.has(row.strategy_type))
    .map((row) => {
      const strategyLabel =
        row.label ?? ADVISOR_STRATEGY_LABELS[row.strategy_type] ?? row.strategy_type
      return {
        user_id: user.id,
        type: 'advisor_strategy_recommended',
        title: 'New advisor strategy recommendation',
        body: `${strategyLabel} was added to your recommended strategies list.`,
        delivery: 'in_app',
        read: false,
        metadata: { strategy_type: row.strategy_type, household_id: householdRow.id },
      }
    })

  if (newRecommendationNotifs.length > 0) {
    await supabase.from('notifications').insert(newRecommendationNotifs)
  }

  const [
    composition,
    { data: liabilitiesRows },
    { data: trustRows },
    { data: federalBracketRows },
    { data: giftingSummaryData, error: giftingSummaryError },
    { data: giftHistoryRows },
    { data: advisorLineItemRows },
    { data: retirementAssetRows },
  ] = await Promise.all([
    classifyEstateAssets(supabase, householdRow.id),
    supabase.from('liabilities').select('balance').eq('owner_id', user.id),
    supabase
      .from('trusts')
      .select('excludes_from_estate, excluded_from_estate, funding_amount')
      .eq('owner_id', user.id),
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
      .select('strategy_source, amount, sign, confidence_level, effective_year, metadata')
      .eq('household_id', householdRow.id)
      .eq('source_role', 'advisor')
      .eq('is_active', true),
    supabase
      .from('assets')
      .select('type, value, owner')
      .eq('owner_id', user.id)
      .in('type', ['traditional_ira', 'traditional_401k', 'sep_account', 'roth_ira', 'roth_401k']),
  ])

  const strategyItems = (composition.outside_strategy_items ?? []) as OutsideStrategyItem[]
  const strategyReductionTotal = strategyItems
    .filter((s) => s.confidence_level !== 'illustrative')
    .reduce((sum, s) => sum + s.amount, 0)

  const totalLiabilities = (liabilitiesRows ?? []).reduce((sum, row) => sum + num(row.balance), 0)
  const trustsExcluded = trustsExcludedSum(
    (trustRows ?? []) as Array<{
      excludes_from_estate?: boolean
      excluded_from_estate?: unknown
      funding_amount?: unknown
    }>,
  )
  const latestYear = Math.max(...(federalBracketRows ?? []).map((b) => num(b.tax_year)), 0)
  const federalBrackets: EstateTaxBracket[] = (federalBracketRows ?? [])
    .filter((b) => num(b.tax_year) === latestYear)
    .map((b) => ({
      min_amount: num(b.min_amount),
      max_amount: num(b.max_amount),
      rate_pct: num(b.rate_pct),
    }))

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
  // RMD start age: 73 for born 1951-1959, 75 for born 1960+
  function getRMDStartAge(birthYear: number): number {
    if (birthYear >= 1960) return 75
    if (birthYear >= 1951) return 73
    return 72
  }
  function getRMDFactor(age: number): number {
    // Simplified IRS Uniform Lifetime Table — factor decreases ~1 per year after 72
    return Math.max(1.0, 27.4 - (age - 72))
  }

  const p1BirthYear = householdRow.person1_birth_year ?? new Date().getFullYear() - 50
  const p1CurrentAge = new Date().getFullYear() - p1BirthYear
  const rmdStartAge = getRMDStartAge(p1BirthYear)
  const annualRMD =
    p1CurrentAge >= rmdStartAge && preIRABalance > 0
      ? Math.round(preIRABalance / getRMDFactor(p1CurrentAge))
      : 0

  // Federal exemption from brackets or fallback
  const federalExemptionForContext =
    federalBrackets.length > 0
      ? filing === 'married_joint'
        ? 30_000_000
        : 15_000_000
      : 13_990_000

  const estateContext: EstateContext = {
    grossEstate: grossEstate,
    federalExemption: federalExemptionForContext,
    estimatedFederalTax: taxWithoutStrategies,
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
  const perRecipientLimit = splitSelected ? 38000 : 19000
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <MyEstateTrustStrategyClient
        householdId={householdRow.id}
        userRole={access.isAdvisor ? 'advisor' : 'consumer'}
        consumerTier={access.tier}
        initialTab={searchParams.tab ?? 'gifting'}
        advisorRecommendations={advisorRecommendations ?? []}
        advisorLineItems={advisorLineItemRows ?? []}
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
      />
    </div>
  )
}
