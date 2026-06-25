#!/usr/bin/env npx tsx
/**
 * Assert tier-restructure E2E persona matrix after seed:e2e.
 *
 * Usage:
 *   npm run verify:e2e-persona-matrix
 */
import { createAdminClient } from '../lib/supabase/admin'
import { E2E_PERSONA_MATRIX } from './e2e-persona-matrix'
import { initSupabaseEnv, verifyE2eAccounts } from './seed-e2e-lib'

async function main() {
  initSupabaseEnv()

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Need SUPABASE_SERVICE_ROLE_KEY from .env.local')
    process.exit(1)
  }

  console.log(`=== E2E persona matrix (${E2E_PERSONA_MATRIX.length} branches) ===\n`)
  for (const row of E2E_PERSONA_MATRIX) {
    console.log(`  • ${row.branch} → ${row.email}`)
  }
  console.log('')

  await verifyE2eAccounts()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
