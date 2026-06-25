#!/usr/bin/env npx tsx
/**
 * Assert tier-restructure E2E persona matrix after seed:e2e.
 *
 * Exit codes:
 *   0 — matrix satisfied
 *   1 — seeded but wrong (real regression)
 *   2 — identities missing (run seed:e2e first; not a resolver bug)
 *
 * Usage:
 *   npm run verify:e2e-persona-matrix
 */
import { createAdminClient } from '../lib/supabase/admin'
import {
  E2E_PERSONA_MATRIX,
  formatPersonaMatrixNotSeededMessage,
  isPersonaMatrixNotSeededOnly,
  personaMatrixHasIssues,
  verifyE2ePersonaMatrix,
} from './e2e-persona-matrix'
import { initSupabaseEnv } from './seed-e2e-lib'

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

  const admin = createAdminClient()
  const result = await verifyE2ePersonaMatrix(admin)

  if (!personaMatrixHasIssues(result)) {
    console.log(`✓ Persona matrix satisfied (${E2E_PERSONA_MATRIX.length} branches)`)
    return
  }

  if (isPersonaMatrixNotSeededOnly(result)) {
    console.log(formatPersonaMatrixNotSeededMessage(result))
    process.exit(2)
  }

  console.error('E2E persona matrix validation failed (profiles exist but state is wrong):')
  for (const issue of [...result.queryErrors, ...result.mismatches]) {
    console.error(' -', issue)
  }
  if (result.notSeeded.length > 0) {
    console.error('Also missing (re-run seed:e2e):')
    for (const row of result.notSeeded) {
      console.error(` - ${row.email} (${row.branch})`)
    }
  }
  process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
