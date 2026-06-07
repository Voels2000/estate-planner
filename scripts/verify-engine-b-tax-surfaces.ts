/**
 * Engine B surface alignment — composition cache vs estate-plan PDF export tax payload.
 * Run: dotenv -e .env.local -- npx tsx scripts/verify-engine-b-tax-surfaces.ts
 *
 * Optional: HOUSEHOLD_ID=uuid to target a specific household (service role required).
 */

import { createClient } from '@supabase/supabase-js'
import { getCachedComposition } from '@/lib/estate/getCachedComposition'
import { loadEstatePlanPdfTaxPayload } from '@/lib/export/loadEstatePlanPdfTaxPayload'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const householdIdEnv = process.env.HOUSEHOLD_ID?.trim()

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

async function resolveHouseholdId(): Promise<string | null> {
  if (householdIdEnv) return householdIdEnv

  const { data } = await admin
    .from('households')
    .select('id')
    .not('base_case_scenario_id', 'is', null)
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

function assertClose(label: string, a: number, b: number, tolerance = 1): boolean {
  const ok = Math.abs(a - b) <= tolerance
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${a.toLocaleString()} vs ${b.toLocaleString()} (±${tolerance})`)
  return ok
}

async function main() {
  const householdId = await resolveHouseholdId()
  if (!householdId) {
    console.error('No household found — set HOUSEHOLD_ID')
    process.exit(1)
  }

  const { data: household, error } = await admin
    .from('households')
    .select('id, filing_status, has_spouse, state_primary')
    .eq('id', householdId)
    .single()

  if (error || !household) {
    console.error('Household load failed:', error?.message ?? 'not found')
    process.exit(1)
  }

  const { data: gifting } = await admin.rpc('calculate_gifting_summary', {
    p_household_id: householdId,
  })
  const lifetimeGiftsUsed = Math.max(
    0,
    Number((gifting as { lifetime_exemption_used?: number } | null)?.lifetime_exemption_used ?? 0),
  )

  const [composition, exportTax] = await Promise.all([
    getCachedComposition(admin, householdId, 'consumer', lifetimeGiftsUsed),
    loadEstatePlanPdfTaxPayload(admin, householdId, household),
  ])

  const compositionGross = Math.max(0, Number(composition.gross_estate ?? 0))
  const exportGross = Math.max(0, Number(exportTax.federal_estate_tax.gross_estate ?? 0))

  console.log(`\nHousehold ${householdId}`)
  console.log('--- Surface: composition cache vs export-estate-plan (Engine B) ---')

  const checks = [
    assertClose('gross_estate', compositionGross, exportGross),
    exportTax.federal_estate_tax.estimated_tax >= 0,
    exportTax.state_estate_tax.estimated_state_tax >= 0,
  ]

  console.log('\nNote: projection year-0 row uses scenario outputs — not compared here (different inputs).')

  if (!checks.every(Boolean)) process.exit(1)
  console.log('\nAll Engine B export alignment checks passed.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
