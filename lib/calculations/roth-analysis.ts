// lib/calculations/roth-analysis.ts
// Roth conversion analysis layer — runs on top of projection rows.
// The projection engine (projection-complete.ts) handles all income,
// SS age gates, RMDs, and taxes. This file only adds conversion logic.

import type { YearRow } from '@/lib/calculations/projection-complete'

export interface RothAnalysisInputs {
  rows: YearRow[]                  // full projection rows from computeCompleteProjection
  filingStatus: string             // household filing_status
  stateMarginalRate: number        // flat state income tax rate (0–1), e.g. 0.093 for CA
  taxDeferredBalance: number       // current total tax-deferred balance
  rothBalance: number              // current Roth balance
  taxableBalance: number           // current taxable account balance
  growthRateRetirement: number     // for projecting balances forward
  maxAnnualConversion: number      // cap per year, e.g. 500000
  standardDeduction: number        // resolved deduction for this household
  inflationRate: number            // for inflating brackets
  person1BirthYear: number
  person2BirthYear: number | null
  rmdStartAge: number
}

export interface RothYearResult {
  year: number
  age1: number
  age2: number | null
  // Income from projection (already correct)
  totalIncome: number
  ssIncome: number
  rmdAmount: number
  earnedIncome: number
  otherIncome: number
  // Tax from projection
  federalTax: number
  stateTax: number
  totalTax: number
  // Marginal rates
  federalMarginalRate: number
  stateMarginalRate: number
  combinedMarginalRate: number
  // Conversion analysis
  recommendedConversion: number
  conversionRationale: string
  incrementalFederalTax: number
  incrementalStateTax: number
  incrementalTotalTax: number
  // Balances
  taxDeferredEnd: number
  rothEnd: number
  taxableEnd: number
  // Lifetime tracking
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

// ─── Federal bracket helpers ──────────────────────────────────────────────────

const BRACKETS_MFJ = [
  { min: 0,       max: 23200,  rate: 0.10 },
  { min: 23200,   max: 94300,  rate: 0.12 },
  { min: 94300,   max: 201050, rate: 0.22 },
  { min: 201050,  max: 383900, rate: 0.24 },
  { min: 383900,  max: 487450, rate: 0.32 },
  { min: 487450,  max: 731200, rate: 0.35 },
  { min: 731200,  max: Infinity, rate: 0.37 },
]

const BRACKETS_SINGLE = [
  { min: 0,       max: 11600,  rate: 0.10 },
  { min: 11600,   max: 47150,  rate: 0.12 },
  { min: 47150,   max: 100525, rate: 0.22 },
  { min: 100525,  max: 191950, rate: 0.24 },
  { min: 191950,  max: 243725, rate: 0.32 },
  { min: 243725,  max: 609350, rate: 0.35 },
  { min: 609350,  max: Infinity, rate: 0.37 },
]

function getBrackets(filingStatus: string) {
  const isMfj = ['mfj', 'married_joint', 'married_filing_jointly', 'qw'].includes(filingStatus)
  return isMfj ? BRACKETS_MFJ : BRACKETS_SINGLE
}

function inflateBrackets(
  brackets: { min: number; max: number; rate: number }[],
  rate: number,
  years: number
): { min: number; max: number; rate: number }[] {
  const f = Math.pow(1 + rate, years)
  return brackets.map(b => ({
    min: Math.round(b.min * f),
    max: b.max === Infinity ? Infinity : Math.round(b.max * f),
    rate: b.rate,
  }))
}

function getFederalMarginalRate(
  taxableIncome: number,
  brackets: { min: number; max: number; rate: number }[]
): number {
  if (taxableIncome <= 0) return brackets[0].rate
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (taxableIncome > brackets[i].min) return brackets[i].rate
  }
  return brackets[0].rate
}

function getBracketHeadroom(
  taxableIncome: number,
  brackets: { min: number; max: number; rate: number }[],
  peakRate: number,
  maxConversion: number
): number {
  // Find the highest bracket BELOW the peak rate
  // and calculate headroom to the TOP of that bracket
  // This fills all lower brackets in one conversion
  let targetCeiling = 0
  for (const b of brackets) {
    if (b.rate >= peakRate) break
    targetCeiling = b.max === Infinity ? taxableIncome + maxConversion : b.max
  }
  return Math.max(0, targetCeiling - taxableIncome)
}

// ─── Main analysis function ───────────────────────────────────────────────────

export function runRothAnalysis(inputs: RothAnalysisInputs): RothAnalysisResult {
  const {
    rows,
    filingStatus,
    stateMarginalRate,
    taxDeferredBalance: initTaxDeferred,
    rothBalance: initRoth,
    taxableBalance: initTaxable,
    growthRateRetirement,
    maxAnnualConversion,
    standardDeduction,
    inflationRate,
    person1BirthYear,
    person2BirthYear,
    rmdStartAge,
  } = inputs

  const currentYear = new Date().getFullYear()
  const baseBrackets = getBrackets(filingStatus)

  // ── Step 1: Find peak combined marginal rate at RMD start ────────────────
  // Look ahead to the first year RMDs are significant and get the marginal rate
  let peakRmdCombinedRate = 0.22 + stateMarginalRate // default fallback
  for (const row of rows) {
    const age1 = row.age_person1
    if (age1 >= rmdStartAge && row.income_rmd > 0) {
      const yearsOut = row.year - currentYear
      const brackets = inflateBrackets(baseBrackets, inflationRate, yearsOut)
      const taxableIncome = Math.max(0, row.income_total - standardDeduction)
      const fedRate = getFederalMarginalRate(taxableIncome, brackets)
      peakRmdCombinedRate = fedRate + stateMarginalRate
      break
    }
  }

  // ── Step 2: Year-by-year conversion analysis ─────────────────────────────
  let taxDeferred = initTaxDeferred
  let roth = initRoth
  let taxable = initTaxable
  let cumulativeConversions = 0
  let cumulativeLifetimeTaxSavings = 0
  const results: RothYearResult[] = []

  for (const row of rows) {
    const yearsOut = row.year - currentYear
    const age1 = row.age_person1
    const age2 = row.age_person2
    const brackets = inflateBrackets(baseBrackets, inflationRate, yearsOut)

    // Use income_total from projection — already correct
    const totalIncome = row.income_total
    const ssIncome = row.income_ss_person1 + row.income_ss_person2
    const rmdAmount = row.income_rmd
    const earnedIncome = row.income_earned
    const otherIncome = row.income_other

    // Taxable income for marginal rate calculation
    const taxableIncome = Math.max(0, totalIncome - standardDeduction)
    const fedMarginal = getFederalMarginalRate(taxableIncome, brackets)
    const combinedMarginal = fedMarginal + stateMarginalRate

    // Use actual tax from projection rows
    const federalTax = row.tax_federal
    const stateTax = row.tax_state
    const totalTax = row.tax_total

    // ── Conversion logic ────────────────────────────────────────────────────
    // Eligibility: both people must be 59.5+ (use 60 as proxy)
    const p1Age = age1
    const p2Age = age2 ?? 60
    const eligible = p1Age >= 60 && p2Age >= 60

    let conv = 0
    let rationale = ''

    if (!eligible) {
      rationale = p1Age < 60
        ? `Deferred — Person 1 is ${p1Age}, under 60`
        : `Deferred — Person 2 is ${p2Age}, under 60`
    } else if (taxDeferred <= 0) {
      rationale = 'No tax-deferred balance remaining'
    } else if (combinedMarginal >= peakRmdCombinedRate) {
      rationale = `Rate ${Math.round(combinedMarginal * 100)}% already at or above projected RMD rate ${Math.round(peakRmdCombinedRate * 100)}%`
    } else {
      // Find headroom to fill current bracket
      const headroom = getBracketHeadroom(taxableIncome, brackets, peakRmdCombinedRate, maxAnnualConversion)
      if (headroom <= 0) {
        rationale = 'Already at top of current bracket'
        conv = 0
      } else {
        conv = Math.min(headroom, taxDeferred, maxAnnualConversion)
        const stateNote = stateMarginalRate > 0
          ? ` (${Math.round(fedMarginal * 100)}% fed + ${Math.round(stateMarginalRate * 100)}% state)`
          : ''
        rationale = `Convert to top of ${Math.round((peakRmdCombinedRate - stateMarginalRate) * 100)}% bracket${stateNote} — projected RMD rate ${Math.round(peakRmdCombinedRate * 100)}%`
      }
    }

    // Incremental tax cost of conversion
    const incrementalFederalTax = Math.round(conv * fedMarginal)
    const incrementalStateTax = Math.round(conv * stateMarginalRate)
    const incrementalTotalTax = incrementalFederalTax + incrementalStateTax

    // Lifetime savings estimate
    // Future value of converted amount at RMD time × rate differential
    const yearsToRmdStart = Math.max(0, (person1BirthYear + rmdStartAge) - row.year)
    const futureValue = conv * Math.pow(1 + growthRateRetirement, yearsToRmdStart)
    const rmdDistributionFactor = 24.6 // approximate factor at RMD start age 75
    const annualRmdReduction = futureValue / rmdDistributionFactor
    const rateDiff = Math.max(0, peakRmdCombinedRate - combinedMarginal)
    const yearSavings = annualRmdReduction * rateDiff - incrementalTotalTax
    cumulativeLifetimeTaxSavings += yearSavings
    cumulativeConversions += conv

    // Update balances
    const growthRate = growthRateRetirement
    taxDeferred = Math.max(0, taxDeferred - rmdAmount - conv) * (1 + growthRate)
    roth = (roth + conv) * (1 + growthRate)
    taxable = Math.max(0, taxable - incrementalTotalTax) * (1 + growthRate)

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
      stateMarginalRate,
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

  // ── Step 3: Summary ──────────────────────────────────────────────────────
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
    optimalConversionWindow: windowStart && windowEnd
      ? { startYear: windowStart, endYear: windowEnd }
      : null,
    summary,
  }
}
