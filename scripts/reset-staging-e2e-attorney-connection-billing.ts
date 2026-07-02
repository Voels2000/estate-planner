/**
 * Reset e2e-attorney listing on staging for connection-billing spine re-walks.
 *
 *   TEST_ENV=staging dotenv -o -e .env.test.staging -- npx tsx scripts/reset-staging-e2e-attorney-connection-billing.ts
 *
 * - Cancels active Stripe attorney subscription on profile (test mode)
 * - Listing → client_limit=1, billing_floor=0, reset_count=0
 * - Profile → unpaid attorney_tier=0, clears Stripe columns
 * - Removes attorney_clients rows for this listing
 * - Re-seeds 3 consumer_requested rows for manual /attorney/requests walk
 */

import Stripe from 'stripe'
import { createAdminClient } from '../lib/supabase/admin'
import { ensureAttorneyClientRequestRow } from '../lib/attorney/createAttorneyClientRequest'
import { E2E_IDENTITIES } from './e2e-test-identities'
import {
  ensureAttorneyListingAndPortal,
  findUserIdByEmail,
  initSupabaseEnv,
} from './seed-e2e-lib'

const WALK_CONSUMER_EMAILS = [
  E2E_IDENTITIES.consumerTier1.email,
  E2E_IDENTITIES.consumer.email,
  E2E_IDENTITIES.advisorClient.email,
] as const

async function main() {
  initSupabaseEnv()
  const admin = createAdminClient()
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!stripeKey) throw new Error('STRIPE_SECRET_KEY unset')

  const stripe = new Stripe(stripeKey)
  const portal = E2E_IDENTITIES.attorneyPortal

  await ensureAttorneyListingAndPortal()

  const ownerId = await findUserIdByEmail(portal.email)
  if (!ownerId) throw new Error(`Auth user not found: ${portal.email}`)

  const { data: listing } = await admin
    .from('attorney_listings')
    .select('id, firm_name, client_limit, billing_floor, reset_count, profile_id')
    .eq('profile_id', ownerId)
    .maybeSingle()

  if (!listing?.id) throw new Error('Claimed attorney listing missing — run seed:e2e')

  console.log(`\nReset ${portal.email} listing ${listing.id} (${listing.firm_name})`)
  console.log(
    `  before: client_limit=${listing.client_limit} billing_floor=${listing.billing_floor} reset_count=${listing.reset_count}`,
  )

  const { data: profile } = await admin
    .from('profiles')
    .select('subscription_status, attorney_tier, stripe_subscription_id, stripe_customer_id')
    .eq('id', ownerId)
    .single()

  const subId = profile?.stripe_subscription_id?.trim()
  if (subId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId)
      if (sub.status !== 'canceled') {
        await stripe.subscriptions.cancel(subId)
        console.log(`  stripe: canceled ${subId}`)
      } else {
        console.log(`  stripe: already canceled ${subId}`)
      }
    } catch (err) {
      console.warn('  stripe cancel:', err instanceof Error ? err.message : err)
    }
  }

  await admin
    .from('profiles')
    .update({
      subscription_status: null,
      subscription_plan: null,
      subscription_period_end: null,
      stripe_subscription_id: null,
      attorney_tier: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ownerId)

  const { count: linkCount } = await admin
    .from('attorney_clients')
    .delete({ count: 'exact' })
    .eq('attorney_id', listing.id)

  console.log(`  attorney_clients: removed ${linkCount ?? 0} row(s)`)

  await admin
    .from('attorney_listings')
    .update({
      client_limit: 1,
      billing_floor: 0,
      reset_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listing.id)

  const { data: afterListing } = await admin
    .from('attorney_listings')
    .select('client_limit, billing_floor, reset_count')
    .eq('id', listing.id)
    .single()

  const { data: afterProfile } = await admin
    .from('profiles')
    .select('subscription_status, attorney_tier, stripe_subscription_id')
    .eq('id', ownerId)
    .single()

  console.log('\nAfter listing:', afterListing)
  console.log('After profile:', afterProfile)

  console.log('\nSeeding consumer_requested rows for manual walk:')
  for (const email of WALK_CONSUMER_EMAILS) {
    const consumerId = await findUserIdByEmail(email)
    if (!consumerId) {
      console.log(`  SKIP — no auth user: ${email}`)
      continue
    }
    const result = await ensureAttorneyClientRequestRow(admin, {
      attorneyListingId: listing.id,
      consumerUserId: consumerId,
      requestMessage: `E2E connection request from ${email}`,
    })
    console.log(`  ${email} → row ${result.rowId ?? 'failed'}`)
  }

  const { count: pendingCount } = await admin
    .from('attorney_clients')
    .select('id', { count: 'exact', head: true })
    .eq('attorney_id', listing.id)
    .eq('status', 'consumer_requested')

  console.log(`\nPending connection requests: ${pendingCount ?? 0}`)
  console.log(`  UI: https://estate-planner-staging.vercel.app/attorney/requests`)
  console.log('\nSpine (after reset):')
  console.log('  npm run walk:staging-attorney-connection-accepts')
  console.log('  npm run walk:staging-attorney-step4')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
