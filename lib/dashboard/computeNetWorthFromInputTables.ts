import { computeBusinessOwnershipValue } from '@/lib/my-estate-strategy/horizonSnapshots'
import {
  buildNetWorthSummaryFromDashboardInput,
  type NetWorthSummary,
} from '@/lib/view-models/netWorthSummary'
import type { EstateComposition } from '@/lib/estate/types'

type AssetRow = { value?: number | string | null }
type LiabilityRow = { balance?: number | string | null }
type RealEstateRow = {
  current_value?: number | string | null
  mortgage_balance?: number | string | null
}
type BusinessRow = { estimated_value?: unknown; ownership_pct?: unknown }
type BusinessInterestRow = {
  fmv_estimated?: unknown
  total_entity_value?: unknown
  ownership_pct?: unknown
}

export type NetWorthInputTableRows = {
  assets: AssetRow[]
  liabilities: LiabilityRow[]
  realEstate: RealEstateRow[]
  businesses: BusinessRow[]
  businessInterests: BusinessInterestRow[]
}

/** Sum input-table rows the same way composition uses FMV + mortgage in liabilities. */
export function aggregateNetWorthInputRows(rows: NetWorthInputTableRows) {
  const financialAssets = rows.assets.reduce((s, a) => s + Number(a.value ?? 0), 0)
  const realEstateFmv = rows.realEstate.reduce((s, r) => s + Number(r.current_value ?? 0), 0)
  const mortgageBalance = rows.realEstate.reduce((s, r) => s + Number(r.mortgage_balance ?? 0), 0)
  const otherLiabilities = rows.liabilities.reduce((s, l) => s + Number(l.balance ?? 0), 0)
  const businessValue = computeBusinessOwnershipValue(rows.businesses, rows.businessInterests)

  return {
    financialAssets,
    realEstateFmv,
    mortgageBalance,
    otherLiabilities,
    businessValue,
  }
}

/** Tier 0 thin path — no composition RPC, matches composition-path math. */
export function computeNetWorthFromInputTables(rows: NetWorthInputTableRows): NetWorthSummary {
  const agg = aggregateNetWorthInputRows(rows)
  return buildNetWorthSummaryFromDashboardInput({
    composition: null,
    financialAssetsFallback: agg.financialAssets,
    realEstateValueFallback: agg.realEstateFmv,
    businessValueFallback: agg.businessValue,
    insuranceValueFallback: 0,
    mortgageBalance: agg.mortgageBalance,
    otherLiabilities: agg.otherLiabilities,
  })
}

/** Heavy dashboard path when composition cache/RPC is available. */
export function computeNetWorthFromComposition(
  composition: EstateComposition | null,
  rows: NetWorthInputTableRows,
): NetWorthSummary {
  const agg = aggregateNetWorthInputRows(rows)
  return buildNetWorthSummaryFromDashboardInput({
    composition,
    financialAssetsFallback: agg.financialAssets,
    realEstateValueFallback: agg.realEstateFmv,
    businessValueFallback: agg.businessValue,
    insuranceValueFallback: 0,
    mortgageBalance: agg.mortgageBalance,
    otherLiabilities: agg.otherLiabilities,
  })
}

/** PR 2 / PR 3 staging fixture — $1M FMV, $200k mortgage, $250k business → $1.05M net worth. */
export const PR2_NET_WORTH_PARITY_FIXTURE: NetWorthInputTableRows = {
  assets: [],
  liabilities: [],
  realEstate: [{ current_value: 1_000_000, mortgage_balance: 200_000 }],
  businesses: [{ estimated_value: 250_000, ownership_pct: 100 }],
  businessInterests: [],
}

export function compositionForParityFixture(): EstateComposition {
  return {
    inside_financial: 0,
    inside_real_estate: 1_000_000,
    inside_business_gross: 250_000,
    inside_insurance: 0,
    gross_estate: 1_250_000,
    total_liabilities: 200_000,
    net_estate: 1_050_000,
  } as EstateComposition
}
