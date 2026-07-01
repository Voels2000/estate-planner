/**
 * Reset e2e-advisor-empty firm on staging for connection-billing spine re-walks.
 *
 *   TEST_ENV=staging dotenv -o -e .env.test.staging -- npx tsx scripts/reset-staging-e2e-advisor-empty-billing.ts
 *
 * - Cancels active Stripe firm subscription (test mode)
 * - Firm → unpaid, seat_count=1, clears sticky-floor columns when present
 * - Removes advisor_client links for this advisor
 * - Optionally restores e2e-consumer-tier1 from advisor_managed (for clean accept/handoff test)
 */

import Stripe from 'stripe'
import { createAdminClient } from '../lib/supabase/admin'
import { E2E_IDENTITIES } from './e2e-test-identities'
import {
  ensureAdvisorFirmForE2e,
  findUserIdByEmail,
  initSupabaseEnv,
} from './seed-e2e-lib'

async function main() {
  initSupabaseEnv()
  const admin = createAdminClient()
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!stripeKey) throw new Error('STRIPE_SECRET_KEY unset')

  const stripe = new Stripe(stripeKey)
  const empty = E2E_IDENTITIES.advisorEmpty
  const consumerEmail = E2E_IDENTITIES.consumerTier1.email

  const ownerId = await findUserIdByEmail(empty.email)
  if (!ownerId) throw new Error(`Auth user not found: ${empty.email}`)

  const { data: firm } = await admin
    .from('firms')
    .select('id, stripe_subscription_id, subscription_status, seat_count')
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (!firm?.id) throw new Error('Firm row missing')

  console.log(`\nReset ${empty.email} firm ${firm.id}`)
  console.log(`  before: sub=${firm.subscription_status} seat_count=${firm.seat_count}`)

  const subId = firm.stripe_subscription_id?.trim()
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
      console.warn(
        '  stripe cancel:',
        err instanceof Error ? err.message : err,
      )
    }
  }

  const firmUpdate: Record<string, unknown> = {
    subscription_status: null,
    stripe_subscription_id: null,
    seat_count: 1,
    updated_at: new Date().toISOString(),
  }

  const { error: firmErr } = await admin.from('firms').update(firmUpdate).eq('id', firm.id)

  if (!firmErr) {
    const stickyUpdate = {
      client_limit: null,
      billing_floor: 0,
      reset_count: 0,
      updated_at: new Date().toISOString(),
    }
    const { error: stickyErr } = await admin.from('firms').update(stickyUpdate).eq('id', firm.id)
    if (stickyErr && !stickyErr.message.includes('billing_floor')) {
      throw stickyErr
    }
    if (!stickyErr) {
      console.log('  firm: unpaid seat_count=1 sticky-floor cleared')
    } else {
      console.log('  firm: unpaid seat_count=1 (pre-sticky-floor migration)')
    }
  } else {
    throw firmErr
  }

  await admin
    .from('profiles')
    .update({ subscription_status: null, updated_at: new Date().toISOString() })
    .eq('id', ownerId)

  const { count: linkCount } = await admin
    .from('advisor_clients')
    .delete({ count: 'exact' })
    .eq('advisor_id', ownerId)

  console.log(`  advisor_clients: removed ${linkCount ?? 0} link(s)`)

  const consumerId = await findUserIdByEmail(consumerEmail)
  if (consumerId) {
    const { data: consumer } = await admin
      .from('profiles')
      .select('subscription_status, consumer_tier')
      .eq('id', consumerId)
      .single()

    if (consumer?.subscription_status === 'advisor_managed') {
      await admin
        .from('profiles')
        .update({
          subscription_status: 'active',
          consumer_tier: 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', consumerId)
      console.log(`  consumer ${consumerEmail}: restored from advisor_managed → active/tier1`)
    }
  }

  await ensureAdvisorFirmForE2e(ownerId, empty.firmName)
  const finalUpdate: Record<string, unknown> = {
    subscription_status: null,
    stripe_subscription_id: null,
    seat_count: 1,
    updated_at: new Date().toISOString(),
  }
  await admin.from('firms').update(finalUpdate).eq('id', firm.id)
  await admin
    .from('firms')
    .update({ client_limit: null, billing_floor: 0, reset_count: 0 })
    .eq('id', firm.id)
    .then(({ error }) => {
      if (error && !error.message.includes('billing_floor')) throw error
    })

  const { data: after } = await admin
    .from('firms')
    .select('subscription_status, seat_count, stripe_subscription_id')
    .eq('id', firm.id)
    .single()

  console.log('\nAfter:', after)
  console.log('\nReady for spine walk: npm run verify:connection-billing-spine-staging')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
