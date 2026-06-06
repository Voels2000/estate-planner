/**
 * Verify StateTaxPanel / engine B path for all modeled estate-tax states.
 * Run: npx dotenv-cli -e .env.local -- npx tsx scripts/verify-state-tax-panel-states.ts
 */

import { createClient } from '@supabase/supabase-js'
import {
  calculateStateEstateTax,
  stateHasEstateTax,
} from '@/lib/calculations/stateEstateTax'
import {
  MODELED_ESTATE_TAX_STATES,
  parseStateTaxCode,
  shouldShowStateEstateTaxPanel,
  STATE_SPECIAL_RULES,
} from '@/lib/projection/stateRegistry'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const TEST_GROSS = 25_000_000
const TAX_YEAR = new Date().getFullYear()

async function main() {
  if (!url || !serviceKey) {
    console.error('Missing Supabase env')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  let failed = 0

  console.log(`=== StateTaxPanel multi-state verify (${TAX_YEAR}, gross $${TEST_GROSS.toLocaleString()}) ===\n`)

  for (const state of MODELED_ESTATE_TAX_STATES) {
    const parsed = parseStateTaxCode(state)
    const showPanel = shouldShowStateEstateTaxPanel(state, false)
    const specialRules = STATE_SPECIAL_RULES[parsed] ?? []

    const { data: rules } = await admin
      .from('state_estate_tax_rules')
      .select('min_amount, max_amount, rate_pct, exemption_amount')
      .eq('state', state)
      .eq('tax_year', TAX_YEAR)
      .order('min_amount', { ascending: true })

    let brackets = rules ?? []
    if (brackets.length === 0) {
      const { data: fallback } = await admin
        .from('state_estate_tax_rules')
        .select('min_amount, max_amount, rate_pct, exemption_amount')
        .eq('state', state)
        .order('tax_year', { ascending: false })
        .order('min_amount', { ascending: true })
        .limit(20)
      brackets = fallback ?? []
    }

    const mapped = brackets.map((r) => ({
      min_amount: Number(r.min_amount ?? 0),
      max_amount: Number(r.max_amount ?? 9_999_999_999),
      rate_pct: Number(r.rate_pct ?? 0),
      exemption_amount: Number(r.exemption_amount ?? 0),
    }))

    const result =
      mapped.length > 0
        ? calculateStateEstateTax(TEST_GROSS, state, mapped, true)
        : null

    const ok =
      parsed === state &&
      showPanel === true &&
      stateHasEstateTax(state) === true &&
      mapped.length > 0 &&
      result != null &&
      result.stateTax > 0

    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${state} — brackets=${mapped.length} tax=$${result?.stateTax?.toLocaleString() ?? '0'} rules=[${specialRules.join(', ')}]`,
    )
    if (!ok) failed++
  }

  // Non-estate-tax control
  const flParsed = parseStateTaxCode('FL')
  const flShow = shouldShowStateEstateTaxPanel('FL', false)
  const flOk = flParsed === 'other' && flShow === false && stateHasEstateTax('FL') === false
  console.log(`${flOk ? 'PASS' : 'FAIL'} FL (no estate tax) — showPanel=${flShow}`)
  if (!flOk) failed++

  console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`}`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
