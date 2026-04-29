import { calcStateIncomeTaxDelta, type StateIncomeTaxBracket } from '@/lib/calculations/stateIncomeTax'

export type IncomeTaxYearLabel = {
  yearOffset: number
  taxYear: number
}

export function buildIncomeTaxLabelsFromYears(years: number[]): Map<number, number> {
  return new Map(
    years
      .filter((year) => Number.isFinite(Number(year)))
      .map((year) => [Number(year), Number(year)] as const),
  )
}

export function buildIncomeTaxYearLabels(params: {
  currentYear: number
  horizonYears: number
}): IncomeTaxYearLabel[] {
  return Array.from({ length: Math.max(0, params.horizonYears) }, (_, idx) => ({
    yearOffset: idx + 1,
    taxYear: params.currentYear + idx,
  }))
}

export function buildAnnualStateIncomeTaxSavingsSeries(params: {
  currentYear: number
  horizonYears: number
  currentState: string
  targetState: string
  ordinaryIncome: number
  filingStatus: 'single' | 'mfj'
  brackets: StateIncomeTaxBracket[]
}): Array<{ yearOffset: number; taxYear: number; annualSavings: number }> {
  const labels = buildIncomeTaxYearLabels({
    currentYear: params.currentYear,
    horizonYears: params.horizonYears,
  })
  return labels.map((label) => {
    const delta = calcStateIncomeTaxDelta({
      currentState: params.currentState,
      targetState: params.targetState,
      ordinaryIncome: params.ordinaryIncome,
      filingStatus: params.filingStatus,
      brackets: params.brackets,
      taxYear: label.taxYear,
    })
    return {
      yearOffset: label.yearOffset,
      taxYear: label.taxYear,
      annualSavings: delta.annualSavings,
    }
  })
}
