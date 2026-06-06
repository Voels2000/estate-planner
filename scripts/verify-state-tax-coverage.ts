/**
 * Audit state tax coverage — estate, income, inheritance engines vs DB rules.
 * Run: npx dotenv-cli -e .env.local -- npx tsx scripts/verify-state-tax-coverage.ts
 */

import { createClient } from '@supabase/supabase-js'
import {
  calculateStateEstateTax,
  MODELED_ESTATE_TAX_STATES,
  MODELED_INHERITANCE_TAX_STATES,
  NO_STATE_INCOME_TAX_STATES,
  stateHasEstateTax,
} from '@/lib/calculations/stateEstateTax'
import { calculateStateIncomeTax } from '@/lib/calculations/stateIncomeTax'
import { calculateInheritanceTax } from '@/lib/projection/stateRegistry'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const TAX_YEAR = new Date().getFullYear()
const ALL_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]

async function main() {
  if (!url || !serviceKey) {
    console.error('Missing Supabase env')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  let failed = 0

  console.log('=== State tax coverage audit ===\n')

  // ── Estate tax ──
  console.log('-- Estate tax (engine B + state_estate_tax_rules) --')
  for (const state of MODELED_ESTATE_TAX_STATES) {
    const { data: rules } = await admin
      .from('state_estate_tax_rules')
      .select('min_amount, max_amount, rate_pct, exemption_amount')
      .eq('state', state)
      .eq('tax_year', TAX_YEAR)
      .order('min_amount', { ascending: true })

    const brackets = (rules ?? []).map((r) => ({
      min_amount: Number(r.min_amount ?? 0),
      max_amount: Number(r.max_amount ?? 9_999_999_999),
      rate_pct: Number(r.rate_pct ?? 0),
      exemption_amount: Number(r.exemption_amount ?? 0),
    }))

    const ok =
      stateHasEstateTax(state) &&
      brackets.length > 0 &&
      calculateStateEstateTax(25_000_000, state, brackets, true).stateTax >= 0

    console.log(`${ok ? 'PASS' : 'FAIL'} ${state} — brackets=${brackets.length}`)
    if (!ok) failed++
  }

  // ── Income tax ──
  console.log('\n-- State income tax (state_income_tax_brackets) --')
  const { data: incomeRows } = await admin
    .from('state_income_tax_brackets')
    .select('state, tax_year, filing_status, min_amount, max_amount, rate_pct')
    .eq('tax_year', TAX_YEAR)

  const incomeByState = new Map<string, typeof incomeRows>()
  for (const row of incomeRows ?? []) {
    const list = incomeByState.get(row.state) ?? []
    list.push(row)
    incomeByState.set(row.state, list)
  }

  const missingIncome = ALL_STATES.filter((s) => !incomeByState.has(s))
  const expectedNoIncome = missingIncome.every((s) =>
    (NO_STATE_INCOME_TAX_STATES as readonly string[]).includes(s),
  )
  console.log(
    `${expectedNoIncome ? 'PASS' : 'FAIL'} Missing income brackets only in no-tax states: ${missingIncome.join(', ') || 'none'}`,
  )
  if (!expectedNoIncome) failed++

  const caBrackets = (incomeByState.get('CA') ?? []).map((r) => ({
    state: r.state,
    tax_year: r.tax_year,
    filing_status: r.filing_status as 'single' | 'mfj',
    min_amount: Number(r.min_amount),
    max_amount: r.max_amount != null ? Number(r.max_amount) : null,
    rate_pct: Number(r.rate_pct),
  }))
  const caTax = calculateStateIncomeTax({
    stateCode: 'CA',
    ordinaryIncome: 250_000,
    filingStatus: 'single',
    brackets: caBrackets,
    taxYear: TAX_YEAR,
  }).stateTax
  const caOk = caTax > 0
  console.log(`${caOk ? 'PASS' : 'FAIL'} CA sample tax on $250k single = $${caTax.toLocaleString()}`)
  if (!caOk) failed++

  // ── Inheritance tax ──
  console.log('\n-- Inheritance tax (state_inheritance_tax_rules + stateRegistry) --')
  const { data: inheritRows } = await admin.from('state_inheritance_tax_rules').select('state')
  const inheritDb = [...new Set((inheritRows ?? []).map((r) => r.state))].sort()
  const inheritMatch =
    inheritDb.length === MODELED_INHERITANCE_TAX_STATES.length &&
    inheritDb.every((s, i) => s === MODELED_INHERITANCE_TAX_STATES[i])

  console.log(
    `${inheritMatch ? 'PASS' : 'FAIL'} DB states [${inheritDb.join(', ')}] match MODELED_INHERITANCE_TAX_STATES`,
  )
  if (!inheritMatch) failed++

  for (const state of MODELED_INHERITANCE_TAX_STATES) {
    const result = calculateInheritanceTax({
      state: state as 'PA',
      beneficiaryType: 'other',
      inheritanceAmount: 100_000,
    })
    const ok = result.taxDue >= 0
    console.log(`${ok ? 'PASS' : 'FAIL'} ${state} inheritance calc — taxDue=$${result.taxDue}`)
    if (!ok) failed++
  }

  console.log(`\n${failed === 0 ? 'ALL COVERAGE CHECKS PASSED' : `${failed} CHECK(S) FAILED`}`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
