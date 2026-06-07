import type { EstateTaxBracket } from '@/lib/calculations/estate-tax'
import {
  calculateStateEstateTax,
  isMFJFilingStatus,
  resolveActiveStateTax,
  type StateBracket,
} from '@/lib/calculations/stateEstateTax'
import type { EstateComposition } from '@/lib/estate/types'
import {
  computeFederalExportTax,
  filingStatusForFederalTax,
} from '@/lib/tax/federalExportTax'

export type EstatePlanPdfTaxPayload = {
  federal_estate_tax: {
    gross_estate: number
    filing_status: string
    estimated_tax: number
    available_exemption: number
    tcja_in_effect: boolean
  }
  state_estate_tax: {
    estimated_state_tax: number
    domicile_state: string
    state_exemption: number
    effective_rate_pct: number | null
  }
}

/** Engine B tax fields for ConsumerEstatePlanPDF / AttorneyEstatePlanPDF export API. */
export function buildEstatePlanPdfTaxPayload(params: {
  household: {
    filing_status?: string | null
    has_spouse?: boolean | null
    state_primary?: string | null
  }
  composition: EstateComposition
  federalBrackets: EstateTaxBracket[]
  stateBrackets: StateBracket[]
  lifetimeGiftsUsed?: number
  hasBypassTrust?: boolean
}): EstatePlanPdfTaxPayload {
  const grossEstate = Math.max(0, Number(params.composition.gross_estate ?? 0))
  const filingStatus = params.household.filing_status ?? 'single'
  const hasSpouse = Boolean(params.household.has_spouse)
  const stateCode = String(params.household.state_primary ?? '').trim().toUpperCase()
  const lifetimeGiftsUsed =
    params.lifetimeGiftsUsed ?? Math.max(0, Number(params.composition.lifetime_gifts_used ?? 0))

  const { federalTax, federalExemption } = computeFederalExportTax({
    grossEstate,
    filingStatus,
    hasSpouse,
    brackets: params.federalBrackets,
    lifetimeGiftsUsed,
    lawScenario: 'current_law',
  })

  const stateResult = calculateStateEstateTax(
    grossEstate,
    stateCode,
    params.stateBrackets,
    isMFJFilingStatus(filingStatus),
    false,
  )
  const stateTax = resolveActiveStateTax(stateResult, params.hasBypassTrust ?? false)

  const filingForPdf =
    filingStatusForFederalTax(filingStatus) === 'married_joint' ? 'mfj' : 'single'

  const effectiveRatePct =
    grossEstate > 0 && stateTax > 0
      ? Math.round((stateTax / grossEstate) * 1000) / 10
      : null

  return {
    federal_estate_tax: {
      gross_estate: grossEstate,
      filing_status: filingForPdf,
      estimated_tax: federalTax,
      available_exemption: federalExemption,
      tcja_in_effect: true,
    },
    state_estate_tax: {
      estimated_state_tax: stateTax,
      domicile_state: stateCode || '—',
      state_exemption: stateResult.exemptionUsed,
      effective_rate_pct: effectiveRatePct,
    },
  }
}
