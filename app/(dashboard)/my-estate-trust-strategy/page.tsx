import { getUserAccess } from '@/lib/get-user-access'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import MyEstateTrustStrategyClient from './_client'
import { classifyEstateAssets } from '@/lib/estate/classifyEstateAssets'
import { computeFederalEstateTax, type EstateTaxBracket } from '@/lib/calculations/estate-tax'
import type { OutsideStrategyItem } from '@/lib/estate/types'

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
    .select('id, filing_status')
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <MyEstateTrustStrategyClient
        householdId={householdRow.id}
        userRole={access.isAdvisor ? 'advisor' : 'consumer'}
        consumerTier={access.tier}
        initialTab={searchParams.tab ?? 'gifting'}
        advisorRecommendations={advisorRecommendations ?? []}
        strategyImpact={{
          strategyItems,
          strategyReductionTotal,
          taxWithoutStrategies,
          taxWithStrategies,
          taxSavings: Math.max(0, taxWithoutStrategies - taxWithStrategies),
        }}
      />
    </div>
  )
}
