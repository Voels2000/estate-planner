/**
 * Reset e2e-attorney listing on staging for connection-billing spine re-walks.
 *
 *   TEST_ENV=staging dotenv -o -e .env.test.staging -- npx tsx scripts/reset-staging-e2e-attorney-connection-billing.ts
 *
 * - Cancels active Stripe attorney subscription on profile (test mode)
 * - Listing → client_limit=1, billing_floor=0, reset_count=0
 * - Profile → unpaid attorney_tier=0, clears Stripe columns
 * - Removes attorney_clients rows for this listing
 */

import Stripe from 'stripe'
import { createAdminClient } from '../lib/supabase/admin'
import { E2E_IDENTITIES } from './e2e-test-identities'
import {
  ensureAttorneyListingAndPortal,
  findUserIdByEmail,
  initSupabaseEnv,
} from './seed-e2e-lib'

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
  console.log('\nReady for walk:')
  console.log(
    '  TEST_ENV=staging dotenv -o -e .env.test.staging -- npx tsx scripts/walk-staging-attorney-connection-accepts.ts',
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
