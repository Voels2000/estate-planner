import type { AdvisoryMetric } from '@/lib/advisoryMetrics'
import { numericValueForMetric } from '@/lib/advisor/advisoryMetricSeverity'

export const STRATEGY_CATALOG = [
  {
    id: 'grat',
    name: 'GRAT',
    fullName: 'Grantor Retained Annuity Trust',
    description:
      'Transfer asset appreciation above the §7520 hurdle rate to heirs estate-tax free.',
    relevanceKey: 'gratBreakevenRate' as const,
    category: 'trust',
  },
  {
    id: 'slat',
    name: 'SLAT',
    fullName: 'Spousal Lifetime Access Trust',
    description: 'Lock in exemption before sunset while retaining indirect access through spouse.',
    relevanceKey: 'exemptionUtilization' as const,
    category: 'trust',
  },
  {
    id: 'annual_gifting',
    name: 'Annual Gifting',
    fullName: 'Annual Exclusion Gifting Program',
    description:
      'Systematic $18K/person/year gifts to reduce estate without using lifetime exemption.',
    relevanceKey: 'exemptionUtilization' as const,
    category: 'gifting',
  },
  {
    id: 'ilit',
    name: 'ILIT',
    fullName: 'Irrevocable Life Insurance Trust',
    description: 'Remove life insurance death benefit from taxable estate; provide estate liquidity.',
    relevanceKey: 'liquidityCoverage' as const,
    category: 'trust',
  },
  {
    id: 'cst',
    name: 'Credit Shelter Trust',
    fullName: 'Credit Shelter Trust (Bypass Trust)',
    description:
      "Preserve both spouses' exemptions at first death — critical in states without portability.",
    relevanceKey: 'dsueAtRisk' as const,
    category: 'trust',
  },
  {
    id: 'daf',
    name: 'DAF',
    fullName: 'Donor Advised Fund',
    description: 'Charitable strategy that reduces estate and generates income tax deductions.',
    relevanceKey: null,
    category: 'charitable',
  },
  {
    id: 'crt',
    name: 'CRT',
    fullName: 'Charitable Remainder Trust',
    description:
      'Income stream to grantor, remainder to charity — removes assets from estate and generates a charitable deduction.',
    relevanceKey: null,
    category: 'charitable',
  },
  {
    id: 'clat',
    name: 'CLAT',
    fullName: 'Charitable Lead Annuity Trust',
    description:
      'Annuity to charity for a term, remainder to heirs — most effective when §7520 rate is low.',
    relevanceKey: 'gratBreakevenRate' as const,
    category: 'charitable',
  },
  {
    id: 'liquidity',
    name: 'Liquidity Strategy',
    fullName: 'Estate Liquidity Analysis',
    description:
      'Structures liquid assets to cover settlement costs, taxes, and expenses without forced sales.',
    relevanceKey: 'liquidityCoverage' as const,
    category: 'liability',
  },
  {
    id: 'roth',
    name: 'Roth Conversion',
    fullName: 'Roth Conversion Strategy',
    description:
      'Converts pre-tax retirement assets to Roth — reduces future RMDs and taxable estate over time.',
    relevanceKey: null,
    category: 'trust_exclusion',
  },
  {
    id: 'revocable_trust',
    name: 'Revocable Trust',
    fullName: 'Revocable Living Trust',
    description:
      'Avoids probate and provides continuity for asset distribution — foundational document at this estate size.',
    relevanceKey: null,
    category: 'trust_exclusion',
  },
] as const

export type StrategyCatalogEntry = (typeof STRATEGY_CATALOG)[number]

export function deriveHighlightedStrategies(metrics: AdvisoryMetric[]): Set<string> {
  const highlighted = new Set<string>()
  const exemption = metrics.find((m) => m.id === 'exemption_utilization')
  const exemptionPct = exemption ? numericValueForMetric(exemption) : null
  if (exemptionPct !== null && exemptionPct < 50) {
    highlighted.add('slat')
    highlighted.add('annual_gifting')
  }
  const liquidity = metrics.find((m) => m.id === 'liquidity_coverage')
  const liquidityRatio = liquidity ? numericValueForMetric(liquidity) : null
  if (liquidityRatio !== null && liquidityRatio < 1.5) {
    highlighted.add('ilit')
    highlighted.add('liquidity')
  }
  const dsue = metrics.find((m) => m.id === 'dsue_at_risk')
  const dsueVal = dsue ? numericValueForMetric(dsue) : null
  if (dsueVal !== null && dsueVal > 0) {
    highlighted.add('cst')
  }
  const grat = metrics.find((m) => m.id === 'grat_breakeven')
  if (grat && numericValueForMetric(grat) !== null) {
    highlighted.add('grat')
  }
  return highlighted
}

export function getStrategyBenefit(
  strategyId: string,
  metrics: AdvisoryMetric[],
): string | null {
  const npv = metrics.find((m) => m.id === 'strategy_npv')
  const crossover = metrics.find((m) => m.id === 'cst_crossover')
  switch (strategyId) {
    case 'grat':
      return npv && npv.value !== 'Not run' ? `${npv.value} NPV` : null
    case 'cst':
      return crossover && crossover.value !== 'Not modeled'
        ? `Crossover year: ${crossover.value}`
        : null
    default:
      return null
  }
}
