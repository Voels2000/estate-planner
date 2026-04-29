/**
 * Roth conversion analysis on top of canonical projection rows.
 *
 * `projection-complete.ts` supplies income, SS/RMDs, and taxes; this module layers
 * conversion bands and bracket-based federal/state tax estimates for what-if flows.
 */

import type { YearRow } from '@/lib/calculations/projection-complete'
import {
  calculateStateIncomeTax,
  getTopMarginalRate,
  type StateIncomeTaxBracket,
} from '@/lib/calculations/stateIncomeTax'

export interface RothAnalysisInputs {
  rows: YearRow[]
  filingStatus: string
  stateCode?: string | null
  stateIncomeTaxBrackets: StateIncomeTaxBracket[]
  federalIncomeTaxBrackets: Array<{
    filing_status: string
    min_amount: number
    max_amount: number | null
    rate_pct: number
    tax_year?: number | null
    bracket_order?: number | null
  }>
  taxDeferredBalance: number
  rothBalance: number
  taxableBalance: number
  growthRateRetirement: number
  maxAnnualConversion: number
  standardDeduction: number
  inflationRate: number
  person1BirthYear: number
  person2BirthYear: number | null
  rmdStartAge: number
}

export interface RothYearResult {
  year: number
  age1: number
  age2: number | null
  totalIncome: number
  ssIncome: number
  rmdAmount: number
  earnedIncome: number
  otherIncome: number
  federalTax: number
  stateTax: number
  totalTax: number
  federalMarginalRate: number
  stateMarginalRate: number
  combinedMarginalRate: number
  recommendedConversion: number
  conversionRationale: string
  incrementalFederalTax: number
  incrementalStateTax: number
  incrementalTotalTax: number
  taxDeferredEnd: number
  rothEnd: number
  taxableEnd: number
  cumulativeConversions: number
  cumulativeLifetimeTaxSavings: number
}

export interface RothAnalysisResult {
  rows: RothYearResult[]
  totalConversions: number
  totalLifetimeTaxSavings: number
  optimalConversionWindow: { startYear: number; endYear: number } | null
  summary: string
}

function normalizeFederalFilingStatus(filingStatus: string): 'single' | 'mfj' | null {
  const normalized = String(filingStatus ?? '').toLowerCase()
  if (['single', 's', 'mfs', 'married_filing_separately', 'head_of_household', 'hoh'].includes(normalized)) return 'single'
  if (['mfj', 'married_joint', 'married_filing_jointly', 'joint', 'qw', 'qualifying_widow'].includes(normalized)) return 'mfj'
  return null
}

function getFederalBracketsForYear(
  filingStatus: string,
  year: number,
  allBrackets: RothAnalysisInputs['federalIncomeTaxBrackets'],
): Array<{ min: number; max: number; rate: number }> {
  const targetFs = normalizeFederalFilingStatus(filingStatus)
  if (!targetFs || !allBrackets.length) return []

  const byStatus = allBrackets.filter((r) => normalizeFederalFilingStatus(r.filing_status) === targetFs)
  if (!byStatus.length) return []

  const yearRows = byStatus.filter((r) => Number(r.tax_year ?? 0) > 0)
  const selected = yearRows.length
    ? (() => {
        const years = Array.from(new Set(yearRows.map((r) => Number(r.tax_year ?? 0)))).sort((a, b) => a - b)
        const selectedYear = years.filter((y) => y <= year).pop() ?? years[years.length - 1]
        return yearRows.filter((r) => Number(r.tax_year ?? 0) === selectedYear)
      })()
    : byStatus

  return selected
    .slice()
    .sort((a, b) => {
      const minDiff = Number(a.min_amount ?? 0) - Number(b.min_amount ?? 0)
      if (minDiff !== 0) return minDiff
      return Number(a.bracket_order ?? 0) - Number(b.bracket_order ?? 0)
    })
    .map((r) => ({
      min: Number(r.min_amount ?? 0),
      max: r.max_amount == null ? Infinity : Number(r.max_amount),
      rate: Number(r.rate_pct ?? 0) / 100,
    }))
}

function getFederalMarginalRate(taxableIncome: number, brackets: { min: number; max: number; rate: number }[]): number {
  if (!brackets.length) return 0
  if (taxableIncome <= 0) return brackets[0].rate
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (taxableIncome > brackets[i].min) return brackets[i].rate
  }
  return brackets[0].rate
}

function normalizeFilingStatusForState(filingStatus: string): 'single' | 'mfj' {
  return ['mfj', 'married_joint', 'married_filing_jointly', 'qw'].includes(filingStatus) ? 'mfj' : 'single'
}

function getBracketHeadroom(
  taxableIncome: number,
  brackets: { min: number; max: number; rate: number }[],
  peakRate: number,
  maxConversion: number,
): number {
  let targetCeiling = 0
  for (const b of brackets) {
    if (b.rate >= peakRate) break
    targetCeiling = b.max === Infinity ? taxableIncome + maxConversion : b.max
  }
  return Math.max(0, targetCeiling - taxableIncome)
}

export function runRothAnalysis(inputs: RothAnalysisInputs): RothAnalysisResult {
  const {
    rows,
    filingStatus,
    stateCode,
    stateIncomeTaxBrackets,
    federalIncomeTaxBrackets,
    taxDeferredBalance: initTaxDeferred,
    rothBalance: initRoth,
    taxableBalance: initTaxable,
    growthRateRetirement,
    maxAnnualConversion,
    standardDeduction,
    person1BirthYear,
    rmdStartAge,
  } = inputs

  const stateFilingStatus = normalizeFilingStatusForState(filingStatus)
  let peakRmdCombinedRate = 0.22
  for (const row of rows) {
    if (row.age_person1 >= rmdStartAge && row.income_rmd > 0) {
      const federalBrackets = getFederalBracketsForYear(filingStatus, row.year, federalIncomeTaxBrackets)
      const taxableIncome = Math.max(0, row.income_total - standardDeduction)
      const fedRate = getFederalMarginalRate(taxableIncome, federalBrackets)
      const stateRate = (getTopMarginalRate(
        stateCode,
        taxableIncome,
        stateFilingStatus,
        stateIncomeTaxBrackets,
        row.year,
      ) ?? 0) / 100
      peakRmdCombinedRate = fedRate + stateRate
      break
    }
  }

  let taxDeferred = initTaxDeferred
  let roth = initRoth
  let taxable = initTaxable
  let cumulativeConversions = 0
  let cumulativeLifetimeTaxSavings = 0
  const results: RothYearResult[] = []

  for (const row of rows) {
    const age1 = row.age_person1
    const age2 = row.age_person2
    const federalBrackets = getFederalBracketsForYear(filingStatus, row.year, federalIncomeTaxBrackets)
    const totalIncome = row.income_total
    const ssIncome = row.income_ss_person1 + row.income_ss_person2
    const rmdAmount = row.income_rmd
    const earnedIncome = row.income_earned
    const otherIncome = row.income_other
    const taxableIncome = Math.max(0, totalIncome - standardDeduction)
    const fedMarginal = getFederalMarginalRate(taxableIncome, federalBrackets)
    const stateMarginalForYear = (getTopMarginalRate(
      stateCode,
      taxableIncome,
      stateFilingStatus,
      stateIncomeTaxBrackets,
      row.year,
    ) ?? 0) / 100
    const combinedMarginal = fedMarginal + stateMarginalForYear
    const federalTax = row.tax_federal
    const stateTax = row.tax_state
    const totalTax = row.tax_total

    const p2Age = age2 ?? 60
    const eligible = age1 >= 60 && p2Age >= 60
    let conv = 0
    let rationale = ''

    if (!eligible) {
      rationale = age1 < 60 ? `Deferred — Person 1 is ${age1}, under 60` : `Deferred — Person 2 is ${p2Age}, under 60`
    } else if (taxDeferred <= 0) {
      rationale = 'No tax-deferred balance remaining'
    } else if (combinedMarginal >= peakRmdCombinedRate) {
      rationale = `Rate ${Math.round(combinedMarginal * 100)}% already at or above projected RMD rate ${Math.round(peakRmdCombinedRate * 100)}%`
    } else {
      const headroom = getBracketHeadroom(taxableIncome, federalBrackets, peakRmdCombinedRate, maxAnnualConversion)
      if (headroom <= 0) {
        rationale = 'Already at top of current bracket'
      } else {
        conv = Math.min(headroom, taxDeferred, maxAnnualConversion)
        const stateNote = stateMarginalForYear > 0
          ? ` (${Math.round(fedMarginal * 100)}% fed + ${Math.round(stateMarginalForYear * 100)}% state)`
          : ''
        rationale = `Convert while below projected RMD combined rate${stateNote} — projected RMD rate ${Math.round(peakRmdCombinedRate * 100)}%`
      }
    }

    const incrementalFederalTax = Math.round(conv * fedMarginal)
    const stateBefore = calculateStateIncomeTax({
      stateCode,
      ordinaryIncome: taxableIncome,
      filingStatus: stateFilingStatus,
      brackets: stateIncomeTaxBrackets,
      taxYear: row.year,
    }).stateTax
    const stateAfter = calculateStateIncomeTax({
      stateCode,
      ordinaryIncome: taxableIncome + conv,
      filingStatus: stateFilingStatus,
      brackets: stateIncomeTaxBrackets,
      taxYear: row.year,
    }).stateTax
    const incrementalStateTax = Math.round(stateAfter - stateBefore)
    const incrementalTotalTax = incrementalFederalTax + incrementalStateTax

    const yearsToRmdStart = Math.max(0, (person1BirthYear + rmdStartAge) - row.year)
    const futureValue = conv * Math.pow(1 + growthRateRetirement, yearsToRmdStart)
    const annualRmdReduction = futureValue / 24.6
    const rateDiff = Math.max(0, peakRmdCombinedRate - combinedMarginal)
    const yearSavings = annualRmdReduction * rateDiff - incrementalTotalTax
    cumulativeLifetimeTaxSavings += yearSavings
    cumulativeConversions += conv

    taxDeferred = Math.max(0, taxDeferred - rmdAmount - conv) * (1 + growthRateRetirement)
    roth = (roth + conv) * (1 + growthRateRetirement)
    taxable = Math.max(0, taxable - incrementalTotalTax) * (1 + growthRateRetirement)

    results.push({
      year: row.year,
      age1,
      age2,
      totalIncome,
      ssIncome,
      rmdAmount,
      earnedIncome,
      otherIncome,
      federalTax,
      stateTax,
      totalTax,
      federalMarginalRate: fedMarginal,
      stateMarginalRate: stateMarginalForYear,
      combinedMarginalRate: combinedMarginal,
      recommendedConversion: Math.round(conv),
      conversionRationale: rationale,
      incrementalFederalTax,
      incrementalStateTax,
      incrementalTotalTax,
      taxDeferredEnd: Math.round(taxDeferred),
      rothEnd: Math.round(roth),
      taxableEnd: Math.round(taxable),
      cumulativeConversions: Math.round(cumulativeConversions),
      cumulativeLifetimeTaxSavings: Math.round(cumulativeLifetimeTaxSavings),
    })
  }

  let windowStart: number | null = null
  let windowEnd: number | null = null
  for (const r of results) {
    if (r.recommendedConversion > 0) {
      if (windowStart === null) windowStart = r.year
      windowEnd = r.year
    }
  }

  const totalConversions = Math.round(cumulativeConversions)
  const totalSavings = Math.round(cumulativeLifetimeTaxSavings)
  const summary = totalConversions > 0
    ? `Converting ${totalConversions.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} over ${windowStart}–${windowEnd} is estimated to save ${totalSavings.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} in lifetime taxes by reducing future RMDs.`
    : 'No conversions recommended — current combined tax rate meets or exceeds projected RMD rate.'

  return {
    rows: results,
    totalConversions,
    totalLifetimeTaxSavings: totalSavings,
    optimalConversionWindow: windowStart && windowEnd ? { startYear: windowStart, endYear: windowEnd } : null,
    summary,
  }
}
