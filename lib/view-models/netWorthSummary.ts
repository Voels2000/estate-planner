import type { EstateComposition } from '@/lib/estate/types'

type DashboardNetWorthInput = {
  composition?: EstateComposition | null
  financialAssetsFallback: number
  realEstateValueFallback: number
  businessValueFallback: number
  insuranceValueFallback: number
  mortgageBalance: number
  otherLiabilities: number
}

type CompositionNetWorthInput = {
  composition: EstateComposition
}

export type NetWorthSummary = {
  financialAssets: number
  realEstateValue: number
  businessValue: number
  insuranceValue: number
  totalAssets: number
  totalLiabilities: number
  netWorth: number
}

export function buildNetWorthSummaryFromDashboardInput(input: DashboardNetWorthInput): NetWorthSummary {
  const financialAssets = input.composition?.inside_financial ?? input.financialAssetsFallback
  const realEstateValue = input.composition?.inside_real_estate ?? input.realEstateValueFallback
  const businessValue = input.composition?.inside_business_gross ?? input.businessValueFallback
  const insuranceValue = input.composition?.inside_insurance ?? input.insuranceValueFallback
  const totalAssets = financialAssets + realEstateValue + businessValue
  const totalLiabilities = input.mortgageBalance + input.otherLiabilities
  const netWorth = totalAssets - totalLiabilities

  return {
    financialAssets,
    realEstateValue,
    businessValue,
    insuranceValue,
    totalAssets,
    totalLiabilities,
    netWorth,
  }
}

export function buildNetWorthSummaryFromComposition(input: CompositionNetWorthInput): NetWorthSummary {
  const { composition } = input

  return {
    financialAssets: Number(composition.inside_financial ?? 0),
    realEstateValue: Number(composition.inside_real_estate ?? 0),
    businessValue: Number(composition.inside_business_gross ?? 0),
    insuranceValue: Number(composition.inside_insurance ?? 0),
    totalAssets: Number(composition.gross_estate ?? 0),
    totalLiabilities: Number(composition.total_liabilities ?? 0),
    netWorth: Number(composition.net_estate ?? 0),
  }
}
