/**
 * Shared reset for directory claim magic-link staging walks.
 */

import { randomBytes } from 'node:crypto'
import { createAdminClient } from '../lib/supabase/admin'
import { findUserIdByEmail } from './seed-e2e-lib'
import { DIRECTORY_CLAIM_WALK_FIXTURES, WALK_LISTING_SOURCE } from './directory-claim-walk-fixture'

async function deleteAuthUser(admin: ReturnType<typeof createAdminClient>, email: string) {
  const userId = await findUserIdByEmail(email)
  if (!userId) return
  const { data: profile } = await admin
    .from('profiles')
    .select('firm_id')
    .eq('id', userId)
    .maybeSingle()
  if (profile?.firm_id) {
    await admin.from('firm_members').delete().eq('firm_id', profile.firm_id)
    await admin.from('firms').delete().eq('id', profile.firm_id)
  }
  await admin.from('profiles').delete().eq('id', userId)
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    console.warn(`  auth delete ${email}:`, error.message)
  } else {
    console.log(`  removed auth user ${email}`)
  }
}

function newClaimToken(): string {
  return randomBytes(24).toString('base64url')
}

export async function resetDirectoryClaimWalkFixture(): Promise<void> {
  const admin = createAdminClient()

  console.log('\n=== Reset directory claim walk fixture ===\n')

  const { data: existingListings } = await admin
    .from('attorney_listings')
    .select('id, email')
    .eq('source', WALK_LISTING_SOURCE)

  for (const row of existingListings ?? []) {
    await admin.from('attorney_listings').delete().eq('id', row.id)
    console.log(`  deleted attorney listing ${row.id} (${row.email})`)
  }

  const { data: existingAdvisors } = await admin
    .from('advisor_directory')
    .select('id, email')
    .eq('source', WALK_LISTING_SOURCE)

  for (const row of existingAdvisors ?? []) {
    await admin.from('advisor_directory').delete().eq('id', row.id)
    console.log(`  deleted advisor listing ${row.id} (${row.email})`)
  }

  for (const fixture of Object.values(DIRECTORY_CLAIM_WALK_FIXTURES)) {
    await deleteAuthUser(admin, fixture.email)
  }

  const attorneyToken = newClaimToken()
  const advisorToken = newClaimToken()
  const now = new Date().toISOString()

  const attorney = DIRECTORY_CLAIM_WALK_FIXTURES.attorney
  const { data: attorneyRow, error: attorneyErr } = await admin
    .from('attorney_listings')
    .insert({
      firm_name: attorney.firm_name,
      contact_name: attorney.contact_name,
      email: attorney.email,
      website: attorney.website,
      phone: attorney.phone,
      state: attorney.state,
      city: attorney.city,
      bio: attorney.bio,
      specializations: attorney.specializations,
      states_licensed: [attorney.state],
      is_verified: true,
      is_active: true,
      source: WALK_LISTING_SOURCE,
      claim_token: attorneyToken,
      claim_token_created_at: now,
    })
    .select('id, claim_token')
    .single()

  if (attorneyErr || !attorneyRow) {
    throw new Error(`attorney listing insert: ${attorneyErr?.message ?? 'no row'}`)
  }

  const advisor = DIRECTORY_CLAIM_WALK_FIXTURES.advisor
  const { data: advisorRow, error: advisorErr } = await admin
    .from('advisor_directory')
    .insert({
      firm_name: advisor.firm_name,
      contact_name: advisor.contact_name,
      email: advisor.email,
      website: advisor.website,
      adv_link: advisor.adv_link,
      state: advisor.state,
      city: advisor.city,
      bio: advisor.bio,
      specializations: advisor.specializations,
      is_verified: true,
      is_active: true,
      source: WALK_LISTING_SOURCE,
      claim_token: advisorToken,
      claim_token_created_at: now,
    })
    .select('id, claim_token')
    .single()

  if (advisorErr || !advisorRow) {
    throw new Error(`advisor listing insert: ${advisorErr?.message ?? 'no row'}`)
  }

  console.log('\nFixture ready:')
  console.log(`  attorney claim: /claim/${attorneyRow.claim_token}`)
  console.log(`  advisor claim:  /claim/${advisorRow.claim_token}`)
  console.log(`  attorney email:   ${attorney.email}`)
  console.log(`  advisor email:    ${advisor.email}`)
}
