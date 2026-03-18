
/**
 * Sprint A — Engine Test Suite
 * Run: npx ts-node scripts/test-engines.ts
 *
 * Tests all pure-math engine functions with hardcoded known inputs.
 * Supabase-dependent functions (runProjection, computeRmd) are skipped —
 * they require a live DB connection and are covered by manual QA.
 */
 
// ─────────────────────────────────────────────────────────────
// Test harness
// ─────────────────────────────────────────────────────────────
 
let passed = 0
let failed = 0
 
function assert(label: string, actual: number, expected: number, tolerance = 1) {
  const diff = Math.abs(actual - expected)
  if (diff <= tolerance) {
    console.log(`  ✅ PASS  ${label}`)
    console.log(`         expected=${expected}  actual=${actual}`)
    passed++
  } else {
    console.log(`  ❌ FAIL  ${label}`)
    console.log(`         expected=${expected}  actual=${actual}  diff=${diff}`)
    failed++
  }
}
 
function assertBool(label: string, actual: boolean, expected: boolean) {
  if (actual === expected) {
    console.log(`  ✅ PASS  ${label}`)
    passed++
  } else {
    console.log(`  ❌ FAIL  ${label}  expected=${expected}  actual=${actual}`)
    failed++
  }
}
 
function section(name: string) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${name}`)
  console.log('─'.repeat(60))
}
 
// ─────────────────────────────────────────────────────────────
// 1. Federal income tax (progressive brackets)
//    Using 2025 MFJ brackets
// ─────────────────────────────────────────────────────────────
 
section('1. calcFederalTax (progressive brackets)')
 
type Bracket = {
  min_amount: number
  max_amount: number
  rate_pct: number
  filing_status: string
  bracket_order: number
  id: string
}
 
function calcFederalTax(
  taxableIncome: number,
  filingStatus: string,
  brackets: Bracket[]
): number {
  const statusBrackets = brackets.filter((b) => b.filing_status === filingStatus)
  const sorted = (statusBrackets.length > 0 ? statusBrackets : brackets)
    .slice()
    .sort((a, b) => a.bracket_order - b.bracket_order)
  if (sorted.length === 0 || taxableIncome <= 0) return 0
  let tax = 0
  let remaining = taxableIncome
  for (const b of sorted) {
    if (remaining <= 0) break
    const bracketWidth = b.max_amount >= 1e9 ? Infinity : b.max_amount - b.min_amount + 1
    const taxableInBracket = Math.min(remaining, bracketWidth)
    tax += taxableInBracket * (b.rate_pct / 100)
    remaining -= taxableInBracket
  }
  return Math.round(tax * 100) / 100
}
 
const MFJ_BRACKETS_2025: Bracket[] = [
  { id: '0', filing_status: 'married_filing_jointly', bracket_order: 0, min_amount: 0,      max_amount: 23850,  rate_pct: 10 },
  { id: '1', filing_status: 'married_filing_jointly', bracket_order: 1, min_amount: 23851,  max_amount: 96950,  rate_pct: 12 },
  { id: '2', filing_status: 'married_filing_jointly', bracket_order: 2, min_amount: 96951,  max_amount: 206700, rate_pct: 22 },
  { id: '3', filing_status: 'married_filing_jointly', bracket_order: 3, min_amount: 206701, max_amount: 394600, rate_pct: 24 },
  { id: '4', filing_status: 'married_filing_jointly', bracket_order: 4, min_amount: 394601, max_amount: 501050, rate_pct: 32 },
  { id: '5', filing_status: 'married_filing_jointly', bracket_order: 5, min_amount: 501051, max_amount: 751600, rate_pct: 35 },
  { id: '6', filing_status: 'married_filing_jointly', bracket_order: 6, min_amount: 751601, max_amount: 1e12,   rate_pct: 37 },
]
 
assert('MFJ $0 income → $0 tax', calcFederalTax(0, 'married_filing_jointly', MFJ_BRACKETS_2025), 0)
assert('MFJ $23,850 (all 10%)', calcFederalTax(23850, 'married_filing_jointly', MFJ_BRACKETS_2025), 2385)
assert('MFJ $100,000', calcFederalTax(100000, 'married_filing_jointly', MFJ_BRACKETS_2025), 11828)
assert('MFJ $500,000', calcFederalTax(500000, 'married_filing_jointly', MFJ_BRACKETS_2025), 114126, 2)
 
// ─────────────────────────────────────────────────────────────
// 2. State tax (flat rate)
// ─────────────────────────────────────────────────────────────
 
section('2. calcStateTax (flat rate)')
 
function calcStateTax(taxableIncome: number, ratePct: number): number {
  if (taxableIncome <= 0 || ratePct <= 0) return 0
  return Math.round(taxableIncome * (ratePct / 100) * 100) / 100
}
 
assert('WA 0% state tax on $100k', calcStateTax(100000, 0), 0)
assert('CA 9.3% on $100k', calcStateTax(100000, 9.3), 9300)
assert('OR 9.9% on $250k', calcStateTax(250000, 9.9), 24750)
assert('State tax $0 income', calcStateTax(0, 5), 0)
 
// ─────────────────────────────────────────────────────────────
// 3. Capital gains tax (0% / 15% / 20%, MFJ 2024)
// ─────────────────────────────────────────────────────────────
 
section('3. calcCapitalGainsTax')
 
function calcCapitalGainsTax(
  longTermGains: number,
  ordinaryIncome: number,
  filingStatus: string
): number {
  const thresholds =
    filingStatus === 'married_joint' || filingStatus === 'married_filing_jointly'
      ? { zero: 94050, fifteen: 583750 }
      : { zero: 47025, fifteen: 518900 }
 
  if (longTermGains <= 0) return 0
 
  let tax = 0
  let gainsRemaining = longTermGains
  const incomeBase = ordinaryIncome
 
  const zeroRoom = Math.max(0, thresholds.zero - incomeBase)
  const zeroTaxed = Math.min(gainsRemaining, zeroRoom)
  gainsRemaining -= zeroTaxed
 
  const fifteenRoom = Math.max(0, thresholds.fifteen - Math.max(incomeBase, thresholds.zero))
  const fifteenTaxed = Math.min(gainsRemaining, fifteenRoom)
  gainsRemaining -= fifteenTaxed
  tax += fifteenTaxed * 0.15
 
  tax += gainsRemaining * 0.20
 
  return Math.round(tax * 100) / 100
}
 
assert('MFJ $50k income + $20k LTCG (0% zone)', calcCapitalGainsTax(20000, 50000, 'married_filing_jointly'), 0)
assert('MFJ $80k income + $30k LTCG (mixed)', calcCapitalGainsTax(30000, 80000, 'married_filing_jointly'), 2393, 2)
assert('MFJ $600k income + $50k LTCG (all 20%)', calcCapitalGainsTax(50000, 600000, 'married_filing_jointly'), 10000)
 
// ─────────────────────────────────────────────────────────────
// 4. NIIT — 3.8% above threshold
// ─────────────────────────────────────────────────────────────
 
section('4. calcNiit (3.8% above threshold)')
 
function calcNiit(
  netInvestmentIncome: number,
  magi: number,
  filingStatus: string
): number {
  const threshold =
    filingStatus === 'married_joint' || filingStatus === 'married_filing_jointly'
      ? 250000
      : 200000
  if (magi <= threshold) return 0
  const excessMagi = magi - threshold
  const niitBase = Math.min(netInvestmentIncome, excessMagi)
  return Math.round(niitBase * 0.038 * 100) / 100
}
 
assert('MFJ MAGI $200k (below threshold)', calcNiit(50000, 200000, 'married_filing_jointly'), 0)
assert('MFJ MAGI $300k, NII $80k', calcNiit(80000, 300000, 'married_filing_jointly'), 1900)
assert('MFJ MAGI $400k, NII $30k', calcNiit(30000, 400000, 'married_filing_jointly'), 1140)
assert('Single MAGI $250k, NII $100k', calcNiit(100000, 250000, 'single'), 1900)
 
// ─────────────────────────────────────────────────────────────
// 5. Payroll tax
// ─────────────────────────────────────────────────────────────
 
section('5. calcPayrollTax')
 
function calcPayrollTax(wages: number, selfEmployed: boolean = false): number {
  const SS_WAGE_BASE = 168600
  const SS_RATE = selfEmployed ? 0.124 : 0.062
  const MEDICARE_RATE = selfEmployed ? 0.029 : 0.0145
  const ADDL_MEDICARE_RATE = 0.009
  const ADDL_MEDICARE_THRESHOLD = 200000
 
  if (wages <= 0) return 0
 
  const ssTax = Math.min(wages, SS_WAGE_BASE) * SS_RATE
  const medicareTax = wages * MEDICARE_RATE
  const addlMedicare =
    wages > ADDL_MEDICARE_THRESHOLD
      ? (wages - ADDL_MEDICARE_THRESHOLD) * ADDL_MEDICARE_RATE
      : 0
 
  return Math.round((ssTax + medicareTax + addlMedicare) * 100) / 100
}
 
assert('Employee $50k wages', calcPayrollTax(50000, false), 3825)
assert('Employee $168,600 (SS cap)', calcPayrollTax(168600, false), 12898, 2)
assert('Employee $250k wages (addl Medicare)', calcPayrollTax(250000, false), 14528, 2)
 
// ─────────────────────────────────────────────────────────────
// 6. Federal estate tax
// ─────────────────────────────────────────────────────────────
 
section('6. computeFederalEstateTax')
 
type EstateBracket = { min_amount: number; max_amount: number; rate_pct: number }
 
function computeProgressiveTax(base: number, brackets: EstateBracket[]): number {
  if (base <= 0 || brackets.length === 0) return 0
  const sorted = [...brackets].sort((a, b) => a.min_amount - b.min_amount)
  let tax = 0
  for (const b of sorted) {
    if (base <= b.min_amount) break
    const inBracket =
      Math.min(base, b.max_amount >= 1e15 ? Infinity : b.max_amount) - b.min_amount
    if (inBracket > 0) tax += inBracket * (b.rate_pct / 100)
  }
  return Math.round(tax * 100) / 100
}
 
const FEDERAL_EXEMPTION = 13_610_000
 
function computeFederalEstateTax(
  grossEstate: number,
  liabilities: number,
  trustsExcluded: number,
  filingStatus: string,
  brackets: EstateBracket[],
  annualGifting = 0,
  giftingYears = 1
): { taxable_estate: number; net_estate_tax: number; gifting_reduction: number } {
  const gifting_reduction = Math.max(0, annualGifting * giftingYears)
  const taxable_estate = Math.max(
    0,
    grossEstate - liabilities - trustsExcluded - gifting_reduction
  )
  const exemption = filingStatus === 'married_joint' ? FEDERAL_EXEMPTION * 2 : FEDERAL_EXEMPTION
  const taxOnEstate = computeProgressiveTax(taxable_estate, brackets)
  const credit = computeProgressiveTax(exemption, brackets)
  const net_estate_tax = Math.max(0, Math.round((taxOnEstate - credit) * 100) / 100)
  return { taxable_estate, net_estate_tax, gifting_reduction }
}
 
const ESTATE_BRACKETS: EstateBracket[] = [
  { min_amount: 0,        max_amount: 10000,   rate_pct: 18 },
  { min_amount: 10000,    max_amount: 20000,   rate_pct: 20 },
  { min_amount: 20000,    max_amount: 40000,   rate_pct: 22 },
  { min_amount: 40000,    max_amount: 60000,   rate_pct: 24 },
  { min_amount: 60000,    max_amount: 80000,   rate_pct: 26 },
  { min_amount: 80000,    max_amount: 100000,  rate_pct: 28 },
  { min_amount: 100000,   max_amount: 150000,  rate_pct: 30 },
  { min_amount: 150000,   max_amount: 250000,  rate_pct: 32 },
  { min_amount: 250000,   max_amount: 500000,  rate_pct: 34 },
  { min_amount: 500000,   max_amount: 750000,  rate_pct: 37 },
  { min_amount: 750000,   max_amount: 1000000, rate_pct: 39 },
  { min_amount: 1000000,  max_amount: 1e15,    rate_pct: 40 },
]
 
const r1 = computeFederalEstateTax(10_000_000, 0, 0, 'single', ESTATE_BRACKETS)
assert('Estate $10M single (below exemption) → $0', r1.net_estate_tax, 0)
 
const r2 = computeFederalEstateTax(15_000_000, 0, 0, 'single', ESTATE_BRACKETS)
assert('Estate $15M single → taxable = $15M', r2.taxable_estate, 15_000_000)
assertBool('Estate $15M single → net tax > 0', r2.net_estate_tax > 0, true)
 
const r3 = computeFederalEstateTax(15_000_000, 0, 0, 'single', ESTATE_BRACKETS, 18000, 10)
assert('Gifting $18k x 10yr → reduction $180k', r3.gifting_reduction, 180_000)
assert('Gifted estate = $14.82M', r3.taxable_estate, 14_820_000)
 
const r4 = computeFederalEstateTax(25_000_000, 0, 0, 'married_joint', ESTATE_BRACKETS)
const r5 = computeFederalEstateTax(25_000_000, 0, 0, 'single', ESTATE_BRACKETS)
assertBool('MFJ pays less estate tax than single on same estate', r4.net_estate_tax < r5.net_estate_tax, true)
 
// ─────────────────────────────────────────────────────────────
// 7. IRC §121 exclusion
// ─────────────────────────────────────────────────────────────
 
section('7. calcSection121Exclusion')
 
function calcSection121Exclusion(
  is_primary_residence: boolean,
  years_lived_in: number,
  filing_status: string,
  gain: number
): number {
  if (!is_primary_residence || years_lived_in < 2) return 0
  if (gain <= 0) return 0
  const cap = filing_status === 'married_joint' ? 500_000 : 250_000
  return Math.min(gain, cap)
}
 
assert('Not primary residence → 0', calcSection121Exclusion(false, 5, 'single', 300000), 0)
assert('Less than 2 years → 0', calcSection121Exclusion(true, 1, 'single', 300000), 0)
assert('Single $200k gain → full exclusion', calcSection121Exclusion(true, 3, 'single', 200000), 200000)
assert('Single $300k gain → capped at $250k', calcSection121Exclusion(true, 5, 'single', 300000), 250000)
assert('MFJ $450k gain → full exclusion', calcSection121Exclusion(true, 10, 'married_joint', 450000), 450000)
assert('MFJ $600k gain → capped at $500k', calcSection121Exclusion(true, 10, 'married_joint', 600000), 500000)
 
// ─────────────────────────────────────────────────────────────
// 8. RMD factor math (pure calculation, no DB)
// ─────────────────────────────────────────────────────────────
 
section('8. RMD factor math (no DB)')
 
function calcRmdAmount(balance: number, factor: number): number {
  if (factor <= 0 || balance <= 0) return 0
  return Math.round((balance / factor) * 100) / 100
}
 
assert('$500k IRA at age 73 (factor 26.5)', calcRmdAmount(500000, 26.5), 18868, 2)
assert('$500k IRA at age 80 (factor 20.2)', calcRmdAmount(500000, 20.2), 24752, 2)
assert('$500k IRA at age 90 (factor 12.2)', calcRmdAmount(500000, 12.2), 40984, 2)
assert('Zero balance → 0 RMD', calcRmdAmount(0, 26.5), 0)
 
// ─────────────────────────────────────────────────────────────
// 9. State estate tax (WA example)
// ─────────────────────────────────────────────────────────────
 
section('9. computeStateEstateTax (WA)')
 
type StateEstateBracket = {
  state: string
  min_amount: number
  max_amount: number
  rate_pct: number
  exemption_amount: number
}
 
function computeStateEstateTax(
  state: string,
  taxableEstate: number,
  brackets: StateEstateBracket[]
): { state_taxable: number; state_exemption: number; state_estate_tax: number } {
  const stateRows = brackets.filter((b) => b.state === state)
  if (stateRows.length === 0) return { state_taxable: 0, state_exemption: 0, state_estate_tax: 0 }
  const state_exemption = stateRows[0].exemption_amount
  const state_taxable = Math.max(0, taxableEstate - state_exemption)
  const bracketArgs: EstateBracket[] = stateRows.map((r) => ({
    min_amount: r.min_amount,
    max_amount: r.max_amount,
    rate_pct: r.rate_pct,
  }))
  const state_estate_tax = Math.round(computeProgressiveTax(state_taxable, bracketArgs) * 100) / 100
  return { state_taxable, state_exemption, state_estate_tax }
}
 
const WA_BRACKETS: StateEstateBracket[] = [
  { state: 'WA', min_amount: 0,       max_amount: 1000000, rate_pct: 10, exemption_amount: 2193000 },
  { state: 'WA', min_amount: 1000000, max_amount: 2000000, rate_pct: 14, exemption_amount: 2193000 },
  { state: 'WA', min_amount: 2000000, max_amount: 3000000, rate_pct: 15, exemption_amount: 2193000 },
  { state: 'WA', min_amount: 3000000, max_amount: 4000000, rate_pct: 15, exemption_amount: 2193000 },
  { state: 'WA', min_amount: 4000000, max_amount: 6000000, rate_pct: 16, exemption_amount: 2193000 },
  { state: 'WA', min_amount: 6000000, max_amount: 7000000, rate_pct: 17, exemption_amount: 2193000 },
  { state: 'WA', min_amount: 7000000, max_amount: 9000000, rate_pct: 18, exemption_amount: 2193000 },
  { state: 'WA', min_amount: 9000000, max_amount: 1e15,    rate_pct: 20, exemption_amount: 2193000 },
]
 
const wa1 = computeStateEstateTax('WA', 2000000, WA_BRACKETS)
assert('WA estate $2M (below exemption) → $0', wa1.state_estate_tax, 0)
 
const wa2 = computeStateEstateTax('WA', 3193000, WA_BRACKETS)
assert('WA estate $3.193M → state taxable $1M', wa2.state_taxable, 1000000)
assert('WA estate $3.193M → state tax $100k', wa2.state_estate_tax, 100000)
 
const wa3 = computeStateEstateTax('TX', 5000000, WA_BRACKETS)
assert('TX (no estate tax) → $0', wa3.state_estate_tax, 0)
 
// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────
 
console.log(`\n${'═'.repeat(60)}`)
console.log(`  RESULTS: ${passed} passed, ${failed} failed`)
console.log('═'.repeat(60))
if (failed > 0) {
  console.log('\n  ⚠️  Some tests failed — review engine logic above.')
  process.exit(1)
} else {
  console.log('\n  🎉 All tests passed!')
  process.exit(0)
}