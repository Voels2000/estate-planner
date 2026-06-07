#!/usr/bin/env tsx
/**
 * Repair legacy attorney_clients rows after FK canonicalization.
 *
 * - attorney_id: profile uuid → attorney_listings.id
 * - client_id: owner profile uuid → households.id
 *
 * Usage:
 *   dotenv -e .env.local -- npx tsx scripts/repair-attorney-client-fks.ts --dry-run
 *   dotenv -e .env.local -- npx tsx scripts/repair-attorney-client-fks.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const dryRun = process.argv.includes('--dry-run')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  const { data: rows, error } = await admin.from('attorney_clients').select('*')
  if (error) {
    console.error(error.message)
    process.exit(1)
  }

  let attorneyFixed = 0
  let clientFixed = 0
  let skipped = 0

  for (const row of rows ?? []) {
    let attorneyId = row.attorney_id as string
    let clientId = row.client_id as string | null
    let changed = false

    const { data: listingByAttorney } = await admin
      .from('attorney_listings')
      .select('id')
      .eq('id', attorneyId)
      .maybeSingle()

    if (!listingByAttorney) {
      const { data: listingByProfile } = await admin
        .from('attorney_listings')
        .select('id')
        .eq('profile_id', attorneyId)
        .maybeSingle()

      if (listingByProfile?.id) {
        console.log(`  attorney_id ${row.id}: ${attorneyId} → ${listingByProfile.id}`)
        attorneyId = listingByProfile.id
        changed = true
        attorneyFixed++
      }
    }

    if (clientId) {
      const { data: householdById } = await admin
        .from('households')
        .select('id')
        .eq('id', clientId)
        .maybeSingle()

      if (!householdById) {
        const { data: householdByOwner } = await admin
          .from('households')
          .select('id')
          .eq('owner_id', clientId)
          .maybeSingle()

        if (householdByOwner?.id) {
          console.log(`  client_id ${row.id}: ${clientId} → ${householdByOwner.id}`)
          clientId = householdByOwner.id
          changed = true
          clientFixed++
        }
      }
    }

    if (changed) {
      if (!dryRun) {
        const { error: updateError } = await admin
          .from('attorney_clients')
          .update({ attorney_id: attorneyId, client_id: clientId })
          .eq('id', row.id)
        if (updateError) {
          console.error(`  update failed ${row.id}:`, updateError.message)
        }
      }
    } else {
      skipped++
    }
  }

  console.log(
    `\n${dryRun ? '[DRY RUN] ' : ''}attorney_id fixes: ${attorneyFixed}, client_id fixes: ${clientFixed}, unchanged: ${skipped}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
