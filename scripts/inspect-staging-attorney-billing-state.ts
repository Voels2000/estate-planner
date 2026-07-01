/**
 * Dump backend state for e2e-attorney connection billing on staging.
 *
 *   TEST_ENV=staging dotenv -o -e .env.test.staging -- npx tsx scripts/inspect-staging-attorney-billing-state.ts
 */

import Stripe from 'stripe'
import { createAdminClient } from '../lib/supabase/admin'
import { attorneyConnectedHouseholds } from '../lib/billing/connectedHouseholdCount'
import { resolveAttorneyBillableQuantity } from '../lib/billing/attorneyBillableQuantity'
import { resolveStickyBillableQuantity } from '../lib/billing/firmConnectionStickyFloor'
import { rateForCount, ATTORNEY_BANDS, ATTORNEY_FLOOR } from '../lib/pricing/connectionPricing'
import { E2E_IDENTITIES } from './e2e-test-identities'
import { findUserIdByEmail, initSupabaseEnv } from './seed-e2e-lib'

async function main() {
  initSupabaseEnv()
  const admin = createAdminClient()
  const email = E2E_IDENTITIES.attorneyPortal.email
  const attorneyId = await findUserIdByEmail(email)
  if (!attorneyId) throw new Error(`Attorney not found: ${email}`)

  const { data: profile } = await admin
    .from('profiles')
    .select(
      'id, email, full_name, role, attorney_tier, subscription_status, subscription_plan, stripe_customer_id, stripe_subscription_id, subscription_period_end',
    )
    .eq('id', attorneyId)
    .single()

  const { data: listing } = await admin
    .from('attorney_listings')
    .select(
      'id, firm_name, profile_id, client_limit, billing_floor, reset_count, referral_code, is_verified, is_active',
    )
    .eq('profile_id', attorneyId)
    .single()

  const listingId = listing?.id ?? ''
  const connected = listingId ? await attorneyConnectedHouseholds(admin, listingId) : 0
  const floor = listing?.billing_floor ?? 0
  const billable = resolveAttorneyBillableQuantity(connected, floor)
  const rate = billable >= 1 ? rateForCount(billable, ATTORNEY_BANDS, ATTORNEY_FLOOR) : 0
  const mrr = billable * rate

  const { data: clients } = await admin
    .from('attorney_clients')
    .select('id, client_id, status, created_at, accepted_at, request_message')
    .eq('attorney_id', listingId)
    .order('created_at', { ascending: true })

  const householdIds = [...new Set((clients ?? []).map((c) => c.client_id).filter(Boolean))]
  const households: Record<string, string | null> = {}
  for (const hid of householdIds) {
    const { data: h } = await admin.from('households').select('owner_id').eq('id', hid).maybeSingle()
    const { data: p } = h?.owner_id
      ? await admin.from('profiles').select('email').eq('id', h.owner_id).maybeSingle()
      : { data: null }
    households[hid] = p?.email ?? null
  }

  let stripeSub: Record<string, unknown> | null = null
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (stripeKey && profile?.stripe_subscription_id) {
    const stripe = new Stripe(stripeKey)
    try {
      const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id)
      stripeSub = {
        id: sub.id,
        status: sub.status,
        quantity: sub.items.data[0]?.quantity ?? null,
        price_id: sub.items.data[0]?.price?.id ?? null,
        current_period_end: sub.items.data[0]?.current_period_end ?? null,
      }
    } catch (e) {
      stripeSub = { error: e instanceof Error ? e.message : String(e) }
    }
  }

  console.log(
    JSON.stringify(
      {
        attorney: { email, user_id: attorneyId },
        profile,
        listing: listing
          ? {
              ...listing,
              connected_distinct_households: connected,
              computed_billable_qty: billable,
              computed_rate_per_client: rate,
              computed_mrr: mrr,
            }
          : null,
        attorney_clients: (clients ?? []).map((c) => ({
          ...c,
          consumer_email: households[c.client_id] ?? null,
        })),
        stripe_subscription: stripeSub,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
