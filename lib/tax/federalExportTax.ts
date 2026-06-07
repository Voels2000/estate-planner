import {
  computeFederalEstateTax,
  type EstateTaxBracket,
} from '@/lib/calculations/estate-tax'
import { isMFJFilingStatus } from '@/lib/calculations/stateEstateTax'
import {
  estimateFederalEstateTaxSnapshot,
  householdFederalExemption,
} from '@/lib/my-estate-strategy/horizonSnapshots'
import { OBBBA_2026 } from '@/lib/tax/estate-tax-constants'

export function filingStatusForFederalTax(
  filingStatus: string | null | undefined,
): 'single' | 'married_joint' {
  return isMFJFilingStatus(filingStatus) ? 'married_joint' : 'single'
}

export function latestFederalBracketsFromRows(
  rows: Array<{
    tax_year?: unknown
    min_amount?: unknown
    max_amount?: unknown
    rate_pct?: unknown
  }> | null | undefined,
): EstateTaxBracket[] {
  const num = (v: unknown) => Number(v ?? 0)
  const latestYear = Math.max(...(rows ?? []).map((b) => num(b.tax_year)), 0)
  if (latestYear <= 0) return []
  return (rows ?? [])
    .filter((b) => num(b.tax_year) === latestYear)
    .map((b) => ({
      min_amount: num(b.min_amount),
      max_amount: num(b.max_amount),
      rate_pct: num(b.rate_pct),
    }))
}

export function computeFederalExportTax(params: {
  grossEstate: number
  filingStatus: string | null | undefined
  hasSpouse: boolean
  brackets: EstateTaxBracket[]
  lifetimeGiftsUsed?: number
  lawScenario?: 'current_law' | 'no_exemption'
  liabilities?: number
  trustsExcluded?: number
}): { federalTax: number; federalExemption: number } {
  const {
    grossEstate,
    filingStatus,
    hasSpouse,
    brackets,
    lifetimeGiftsUsed = 0,
    lawScenario = 'current_law',
    liabilities = 0,
    trustsExcluded = 0,
  } = params

  const statutoryExemption = householdFederalExemption(filingStatus, hasSpouse)
  const federalExemption =
    lawScenario === 'no_exemption'
      ? 0
      : Math.max(0, statutoryExemption - lifetimeGiftsUsed)

  if (grossEstate <= 0) {
    return { federalTax: 0, federalExemption }
  }

  if (brackets.length === 0) {
    if (lawScenario === 'no_exemption') {
      return {
        federalTax: Math.round(grossEstate * OBBBA_2026.TOP_RATE),
        federalExemption: 0,
      }
    }
    const snapshot = estimateFederalEstateTaxSnapshot({
      grossEstate,
      filingStatus,
      hasSpouse,
      lifetimeGiftsUsed,
    })
    return { federalTax: snapshot.federalTax, federalExemption: snapshot.exemption }
  }

  const filing = filingStatusForFederalTax(filingStatus)
  const result = computeFederalEstateTax(
    grossEstate,
    liabilities,
    trustsExcluded,
    filing,
    brackets,
    0,
    1,
    undefined,
    lifetimeGiftsUsed,
    lawScenario === 'no_exemption' ? 0 : undefined,
  )

  return { federalTax: result.net_estate_tax, federalExemption }
}
