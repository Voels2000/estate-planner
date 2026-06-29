/**
 * Propagation gate — same pass condition as check-pitr-prod.sh, via Management API token.
 * Run: SUPABASE_ACCESS_TOKEN=... npx tsx scripts/check-pitr-prod-once.ts
 */

import {
  assessSupabaseBackupHealth,
  fetchSupabaseBackups,
  PROD_SUPABASE_PROJECT_REF,
} from '@/lib/verify/supabaseBackupHealth'

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
  if (!token) {
    console.error('NOT YET: SUPABASE_ACCESS_TOKEN unset')
    process.exit(1)
  }

  const data = await fetchSupabaseBackups(PROD_SUPABASE_PROJECT_REF, token)
  const result = assessSupabaseBackupHealth(data, 'propagation')

  if (result.ok) {
    console.log(`PITR LIVE: ${result.detail}`)
    process.exit(0)
  }

  console.log(`NOT YET: ${result.detail}`)
  process.exit(1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
