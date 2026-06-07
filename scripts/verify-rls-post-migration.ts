#!/usr/bin/env tsx
/**
 * Post-migration RLS verification — SQL invariants + JWT isolation smoke.
 *
 * Usage:
 *   npm run verify:rls
 *   SUPABASE_DB_URL=postgresql://... npm run verify:rls
 *   npm run verify:rls -- --skip-behavioral
 *   npm run verify:rls -- --require-sql
 *
 * CI: .github/workflows/rls-verify.yml (RLS_VERIFY_IN_CI=true)
 */
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env.test' })

import {
  runRlsVerification,
  summarizeRlsChecks,
} from '../lib/verify/runRlsVerification'

const args = process.argv.slice(2)
const skipBehavioral = args.includes('--skip-behavioral')
const requireSql = args.includes('--require-sql')

async function main() {
  const checks = await runRlsVerification({ skipBehavioral, requireSql })
  const summary = summarizeRlsChecks(checks)

  console.log('RLS post-migration verification\n')
  for (const check of checks) {
    console.log(`${check.pass ? 'PASS' : 'FAIL'}  ${check.id}: ${check.detail}`)
  }
  console.log(`\n${summary.passed}/${checks.length} checks passed`)

  if (!summary.ok) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
