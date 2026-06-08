/**
 * Audit state tax coverage — estate, income, inheritance engines vs DB rules.
 * Run: npm run verify:tax-coverage
 */

import { createClient } from '@supabase/supabase-js'
import { scanTaxCoverage } from '@/lib/tax/admin/scanTaxCoverage'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const TAX_YEAR = Number(process.env.TAX_YEAR) || new Date().getFullYear()

async function main() {
  if (!url || !serviceKey) {
    console.error('Missing Supabase env')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const result = await scanTaxCoverage(admin, TAX_YEAR)

  console.log('=== State tax coverage audit ===\n')
  console.log(`Year: ${TAX_YEAR}`)
  console.log(`Status: ${result.ok ? 'PASS' : 'FAIL'}\n`)

  for (const [domain, s] of Object.entries(result.summary)) {
    console.log(`${s.complete ? 'PASS' : 'FAIL'} ${domain} — rows=${s.rowCount}`)
  }

  if (result.issues.length > 0) {
    console.log('\nIssues:')
    for (const i of result.issues) {
      console.log(`  [${i.severity}] ${i.message}`)
    }
  }

  console.log(`\n${result.ok ? 'ALL COVERAGE CHECKS PASSED' : 'COVERAGE CHECKS FAILED'}`)
  process.exit(result.ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
