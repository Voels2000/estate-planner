#!/usr/bin/env tsx
/**
 * Production promotion schema gate — fail closed before staging→main when stack
 * includes B6 (#67) privacy appeals code.
 *
 * Usage:
 *   npm run verify:promotion-schema
 *   npm run verify:promotion-schema -- --staging   # verify staging after apply
 *
 * Requires PROD_SUPABASE_DB_URL in .env.projects.local (production default).
 */
import { config } from 'dotenv'

config({ path: '.env.projects.local' })
config({ path: '.env.local' })

import {
  resolvePromotionDbUrl,
  runPromotionSchemaVerification,
  summarizePromotionSchemaChecks,
} from '../lib/verify/runPromotionSchemaVerification'

const targetStaging = process.argv.includes('--staging')
const env = targetStaging ? 'staging' : 'production'
const dbUrl = resolvePromotionDbUrl(env)

async function main() {
  if (!dbUrl) {
    const key = targetStaging ? 'STAGING_SUPABASE_DB_URL' : 'PROD_SUPABASE_DB_URL'
    console.error(`Promotion schema gate: ${key} unset (.env.projects.local)`)
    process.exit(1)
  }

  const checks = await runPromotionSchemaVerification(
    dbUrl,
    targetStaging ? 'Staging' : 'Production',
  )
  const summary = summarizePromotionSchemaChecks(checks)

  console.log(`Promotion schema verification (${env})\n`)
  for (const check of checks) {
    console.log(`${check.pass ? 'PASS' : 'FAIL'}  ${check.id}: ${check.detail}`)
  }
  console.log(`\n${summary.passed}/${checks.length} checks passed`)

  if (!summary.ok) {
    console.error(
      '\nApply pending migrations on production before promoting #67+:\n' +
        '  bash scripts/apply-migration.sh production supabase/migrations/20260720120000_privacy_requests_appealed_status.sql\n' +
        '  bash scripts/apply-migration.sh production supabase/migrations/20260721120000_privacy_requests_appeal_due_at.sql',
    )
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
