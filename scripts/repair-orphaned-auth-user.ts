/**
 * Repairs auth.users rows with no matching profiles row (handle_new_user missed).
 *
 * Usage:
 *   npm run repair:orphaned-user -- Test1@rolobe.resend.app
 *   dotenv -e .env.local -- npx tsx scripts/repair-orphaned-auth-user.ts <email>
 */
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getTierFromPriceId } from '../lib/billing/stripePrices'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function syncStripeSubscription(userId: string, email: string) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    console.log('STRIPE_SECRET_KEY not set — skip Stripe sync')
    return
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' })
  const customers = await stripe.customers.list({ email, limit: 1 })
  const customer = customers.data[0]
  if (!customer) {
    console.log('No Stripe customer for this email — set subscription fields manually if needed')
    return
  }

  const subs = await stripe.subscriptions.list({
    customer: customer.id,
    status: 'all',
    limit: 1,
  })
  const sub = subs.data[0]
  if (!sub) {
    console.log('Stripe customer found but no subscription — profile row only')
    return
  }

  const priceId = sub.items.data[0]?.price.id ?? null
  const consumerTier = priceId ? getTierFromPriceId(priceId) : null
  const renewalIso = new Date(sub.current_period_end * 1000).toISOString()

  const coreUpdate = {
    subscription_status: sub.status,
    subscription_plan: priceId,
    subscription_period_end: renewalIso,
    ...(consumerTier ? { consumer_tier: consumerTier } : {}),
  }

  let { error } = await supabase
    .from('profiles')
    .update({
      ...coreUpdate,
      stripe_customer_id: customer.id,
      stripe_subscription_id: sub.id,
    })
    .eq('id', userId)

  if (error?.message?.includes('stripe_subscription_id')) {
    console.warn('stripe_* columns missing on remote DB — updating subscription fields only')
    const retry = await supabase.from('profiles').update(coreUpdate).eq('id', userId)
    error = retry.error
  }

  if (error) {
    console.error('Stripe sync update failed:', error.message)
    return
  }

  console.log(
    `✓ Synced from Stripe: status=${sub.status}, tier=${consumerTier ?? 'unchanged'}, plan=${priceId ?? 'n/a'}`,
  )
}

async function repairOrphanedUser(email: string) {
  const normalized = email.trim()
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  })
  if (listError) {
    console.error('listUsers failed:', listError.message)
    process.exit(1)
  }

  const user = listData.users.find(
    (u) => u.email?.toLowerCase() === normalized.toLowerCase(),
  )
  if (!user) {
    console.error(`No auth user found for ${normalized}`)
    process.exit(1)
  }

  console.log(`Found auth user: ${user.id} (${user.email})`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (profile) {
    console.log('Profile row already exists — no insert needed')
    await syncStripeSubscription(user.id, user.email ?? normalized)
    return
  }

  const role =
    user.user_metadata?.role === 'advisor' || user.user_metadata?.role === 'financial_advisor'
      ? 'advisor'
      : 'consumer'

  const isConsumer = role === 'consumer'

  const { error: insertError } = await supabase.from('profiles').insert({
    id: user.id,
    email: user.email,
    full_name:
      typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : null,
    role,
    consumer_tier: isConsumer ? 1 : null,
    subscription_status: isConsumer ? 'trialing' : null,
    trial_started_at: isConsumer ? new Date().toISOString() : null,
    is_admin: false,
    updated_at: new Date().toISOString(),
  })

  if (insertError) {
    console.error('Failed to insert profile:', insertError.message)
    process.exit(1)
  }

  console.log(`✓ Profile row created for ${user.email} (${user.id})`)
  await syncStripeSubscription(user.id, user.email ?? normalized)
  console.log(
    'If Stripe sync did not run: replay checkout.session.completed in Stripe Dashboard, or UPDATE profiles manually.',
  )
}

const email = process.argv[2]
if (!email) {
  console.error('Usage: npm run repair:orphaned-user -- <email>')
  process.exit(1)
}

repairOrphanedUser(email).catch((err) => {
  console.error(err)
  process.exit(1)
})
