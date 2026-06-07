/**
 * Post-deploy verification — Voels MC Phase 3 + cleanup pass (2026-06-05)
 * Run: npm run verify:post-deploy-voels
 * Cron: GET /api/cron/post-deploy-verify (Bearer CRON_SECRET)
 */

import { runPostDeployVoelsChecks } from '@/lib/verify/runPostDeployVoelsChecks'

async function main() {
  const checks = await runPostDeployVoelsChecks()
  for (const c of checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'} — ${c.id}: ${c.detail}`)
  }

  console.log('\n=== Summary ===')
  const failed = checks.filter((c) => !c.pass)
  for (const c of checks) {
    console.log(`  ${c.pass ? '✓' : '✗'} ${c.id}`)
  }
  if (failed.length) {
    console.error(`\n${failed.length}/${checks.length} checks FAILED`)
    process.exit(1)
  }
  console.log(`\nAll ${checks.length} checks PASSED (data/API layer)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
