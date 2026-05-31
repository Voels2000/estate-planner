import { CST_STRATEGY_SOURCE, isCstStrategyType } from '@/lib/constants/strategyTypes'

export type StrategySavingsContext = {
  grossEstate: number
  totalTax: number
  federalTax: number
  stateTax: number
  federalExemption: number
  stateExemption: number
  hasSpouse: boolean
  section7520Rate: number
  ilitDeathBenefit: number
  gratBreakevenRate: number | null
  liquidityShortfall: number | null
}

function normalizeStrategyKey(strategyKey: string): string {
  const key = strategyKey.toLowerCase()
  if (isCstStrategyType(key)) return CST_STRATEGY_SOURCE
  return key
}

/** Illustrative savings copy for opportunity rows — uses current tab metrics only. */
export function estimateStrategySavings(
  strategyKey: string,
  ctx: StrategySavingsContext,
): string | null {
  const key = normalizeStrategyKey(strategyKey)
  const {
    grossEstate,
    totalTax,
    stateTax,
    federalExemption,
    stateExemption,
    hasSpouse,
    section7520Rate,
    ilitDeathBenefit,
    gratBreakevenRate,
    liquidityShortfall,
  } = ctx

  if (grossEstate <= 0) return null

  switch (key) {
    case CST_STRATEGY_SOURCE: {
      const saving =
        stateExemption > 0 && stateTax > 0
          ? Math.round((stateExemption / grossEstate) * stateTax)
          : 0
      return saving > 0
        ? `Est. saving: ~$${Math.round(saving / 1000)}K in state estate tax today`
        : null
    }
    case 'ilit': {
      const saving =
        ilitDeathBenefit > 0 ? Math.round((ilitDeathBenefit / grossEstate) * totalTax) : 0
      return saving > 0
        ? `Est. saving: ~$${Math.round(saving / 1000)}K — removes policy from taxable estate`
        : null
    }
    case 'annual_gifting': {
      const annualGift = hasSpouse ? 36_000 : 18_000
      const annualSaving = Math.round((annualGift / grossEstate) * totalTax)
      return annualSaving > 0
        ? `Est. saving: ~$${annualSaving.toLocaleString()}/yr in estate tax reduction`
        : `Est. saving: ~$${annualGift.toLocaleString()}/yr exclusion gifts`
    }
    case 'slat': {
      const headroom = Math.max(0, federalExemption - grossEstate)
      if (headroom <= 0) return 'Uses remaining federal exemption headroom before sunset'
      return `Uses remaining federal exemption headroom — $${(headroom / 1_000_000).toFixed(1)}M available`
    }
    case 'grat': {
      if (
        gratBreakevenRate != null &&
        gratBreakevenRate >= section7520Rate * 100 * 0.98
      ) {
        return 'Caution: breakeven equals hurdle rate — review asset growth assumptions first'
      }
      return `Transfers appreciation above ${(section7520Rate * 100).toFixed(1)}% §7520 rate estate-tax free`
    }
    case 'liquidity': {
      if (liquidityShortfall != null && liquidityShortfall > 0) {
        return `Addresses $${Math.round(liquidityShortfall / 1000)}K shortfall · prevents forced asset liquidation`
      }
      return null
    }
    default:
      return null
  }
}
