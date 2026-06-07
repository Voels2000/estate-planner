import {
  computeFederalEstateTax,
  type EstateTaxBracket,
} from '@/lib/calculations/estate-tax'
import {
  calculateStateEstateTax,
  isMFJFilingStatus,
  resolveActiveStateTax,
  type StateBracket,
} from '@/lib/calculations/stateEstateTax'
import type { EstateScenario } from '@/lib/tax/estate-tax-constants'
import { householdFederalExemption, OBBBA_2026 } from '@/lib/tax/estate-tax-constants'

export type FederalTaxContext = {
  filingStatus: string | null | undefined
  hasSpouse: boolean
  brackets: EstateTaxBracket[]
  lifetimeGiftsUsed?: number
  lawScenario?: EstateScenario
  liabilities?: number
  trustsExcluded?: number
  /** Use a precomputed exemption cap (MC, projection death rows) instead of statutory − gifts. */
  exemptionCapOverride?: number
}

export type CombinedEstateTaxContext = FederalTaxContext & {
  statePrimary?: string | null
  stateBrackets?: StateBracket[]
  hasBypassTrust?: boolean
}

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

function resolveFederalExemptionDisplay(params: FederalTaxContext): number {
  const {
    filingStatus,
    hasSpouse,
    lifetimeGiftsUsed = 0,
    lawScenario = 'current_law',
    exemptionCapOverride,
  } = params
  if (lawScenario === 'no_exemption') return 0
  if (exemptionCapOverride !== undefined) return Math.max(0, exemptionCapOverride)
  return Math.max(0, householdFederalExemption(filingStatus, hasSpouse) - lifetimeGiftsUsed)
}

export function computeFederalExportTax(
  params: FederalTaxContext & { grossEstate: number },
): { federalTax: number; federalExemption: number } {
  const {
    grossEstate,
    filingStatus,
    hasSpouse,
    brackets,
    lifetimeGiftsUsed = 0,
    lawScenario = 'current_law',
    liabilities = 0,
    trustsExcluded = 0,
    exemptionCapOverride,
  } = params

  const federalExemption = resolveFederalExemptionDisplay(params)

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
    const federalExposure = Math.max(0, grossEstate - federalExemption)
    return {
      federalTax: Math.round(federalExposure * OBBBA_2026.TOP_RATE),
      federalExemption,
    }
  }

  const filing = filingStatusForFederalTax(filingStatus)
  const engineCapOverride =
    lawScenario === 'no_exemption'
      ? 0
      : exemptionCapOverride !== undefined
        ? exemptionCapOverride
        : undefined
  const engineLifetimeUsed = exemptionCapOverride !== undefined ? 0 : lifetimeGiftsUsed

  const result = computeFederalEstateTax(
    grossEstate,
    liabilities,
    trustsExcluded,
    filing,
    brackets,
    0,
    1,
    undefined,
    engineLifetimeUsed,
    engineCapOverride,
  )

  return { federalTax: result.net_estate_tax, federalExemption }
}

/** Federal estate tax only — used by MC and combined estate tax helpers. */
export function computeFederalTaxOnly(grossEstate: number, ctx: FederalTaxContext): number {
  return computeFederalExportTax({ grossEstate, ...ctx }).federalTax
}

/** Federal + state estate tax (state via engine B). */
export function computeCombinedEstateTax(grossEstate: number, ctx: CombinedEstateTaxContext): number {
  const federalTax = computeFederalTaxOnly(grossEstate, ctx)
  const stateBrackets = ctx.stateBrackets ?? []
  if (stateBrackets.length === 0 || grossEstate <= 0) return federalTax

  const stateResult = calculateStateEstateTax(
    grossEstate,
    ctx.statePrimary ?? '',
    stateBrackets,
    isMFJFilingStatus(ctx.filingStatus),
    ctx.hasBypassTrust ?? false,
  )
  const stateTax = resolveActiveStateTax(stateResult, ctx.hasBypassTrust ?? false)
  return federalTax + stateTax
}

/** Marginal federal tax saved when `reduction` is removed from `grossEstate`. */
export function federalTaxSavedByReduction(
  grossEstate: number,
  reduction: number,
  ctx: FederalTaxContext,
): number {
  if (reduction <= 0 || grossEstate <= 0) return 0
  const before = computeFederalTaxOnly(grossEstate, ctx)
  const after = computeFederalTaxOnly(Math.max(0, grossEstate - reduction), ctx)
  return Math.max(0, before - after)
}
