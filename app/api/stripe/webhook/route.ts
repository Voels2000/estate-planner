import { NextRequest, NextResponse } from 'next/server'
import { sendRenewalReminderEmail } from '@/lib/email/renewalReminderEmail'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { FIRM_PRICE_ID_TO_TIER, PRICE_ID_TO_TIER } from '@/lib/tiers'
import { trackTierUpgrade } from '@/lib/analytics/trackUpgrade'
import {
  cancelPendingDeletionOnReactivation,
  scheduleDeletionOnSubscriptionCancelled,
} from '@/lib/compliance/scheduleDeletionOnCancel'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function formatUsdCents(amountCents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountCents / 100)
}

function formatRenewalDate(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

async function sendConsumerRenewalReminder(
  supabase: ReturnType<typeof createAdminClient>,
  customerId: string,
  subscription: Stripe.Subscription,
  invoice: Stripe.Invoice,
) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  const to = profile?.email
  if (!to) return

  const reminderKey = String(subscription.current_period_end)
  if (subscription.metadata?.renewal_reminder_sent_for === reminderKey) return

  const line = invoice.lines.data[0]
  const planName =
    (typeof line?.price?.product === 'object' && line.price.product && 'name' in line.price.product
      ? (line.price.product as Stripe.Product).name
      : null) ?? 'My Wealth Maps'
  const price = formatUsdCents(invoice.amount_due ?? line?.amount ?? 0)
  const renewalDate = formatRenewalDate(subscription.current_period_end)

  await sendRenewalReminderEmail(to, planName, price, renewalDate)

  await stripe.subscriptions.update(subscription.id, {
    metadata: {
      ...subscription.metadata,
      renewal_reminder_sent_for: reminderKey,
    },
  })
}

function mapFirmSubscriptionStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case 'active':
      return 'active'
    case 'trialing':
      return 'trialing'
    case 'past_due':
      return 'past_due'
    case 'canceled':
      return 'canceled'
    default:
      return status
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }
  try {
    const supabase = createAdminClient()
    console.log('Webhook received:', event.type)
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const firmId = session.metadata?.firm_id
        if (firmId) {
          const subscriptionId = session.subscription as string | null
          if (subscriptionId) {
            const sub = await stripe.subscriptions.retrieve(subscriptionId)
            const priceId = sub.items.data[0]?.price.id
            const firmTier = priceId
              ? FIRM_PRICE_ID_TO_TIER[priceId]
              : undefined
            const update: {
              stripe_subscription_id: string
              subscription_status: 'active'
              tier?: string
            } = {
              stripe_subscription_id: subscriptionId,
              subscription_status: 'active',
            }
            if (firmTier) {
              update.tier = firmTier
            }
            const { data, error } = await supabase
              .from('firms')
              .update(update)
              .eq('id', firmId)
              .select()
            if (error) {
              console.error('Firm Supabase update error:', error.message)
            }
            const ownerId = data?.[0]?.owner_id as string | undefined
            if (ownerId) {
              const { error: profileError } = await supabase
                .from('profiles')
                .update({ subscription_status: 'active' })
                .eq('id', ownerId)
              if (profileError) {
                console.error(
                  'Failed to update firm owner profile subscription_status:',
                  profileError
                )
              }
            }
          } else {
            console.log('checkout.session.completed — firm checkout without subscription id')
          }
          break
        }
        const userId = session.metadata?.userId
        if (userId) {
          const { data: priorProfile } = await supabase
            .from('profiles')
            .select('consumer_tier')
            .eq('id', userId)
            .single()
          const previousTier = priorProfile?.consumer_tier ?? 0

          const subId = session.subscription as string | null
          let renewalIso: string | null = null
          let priceId: string | null = null
          let consumerTier: number | null = null
          if (subId) {
            const sub = await stripe.subscriptions.retrieve(subId)
            renewalIso = new Date(sub.current_period_end * 1000).toISOString()
            priceId = sub.items.data[0]?.price.id ?? null
            consumerTier = priceId ? (PRICE_ID_TO_TIER[priceId] ?? null) : null
          }
          const { error } = await supabase
            .from('profiles')
            .update({
              subscription_status: 'active',
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: subId,
              subscription_plan: priceId,
              ...(consumerTier ? { consumer_tier: consumerTier } : {}),
              ...(renewalIso ? { subscription_period_end: renewalIso } : {}),
            })
            .eq('id', userId)
          if (error) {
            console.error('Supabase update error:', error.message)
          }

          if (consumerTier && consumerTier > previousTier) {
            void trackTierUpgrade({
              userId,
              tier: consumerTier,
              previousTier,
            })
          }
        } else {
          console.log('checkout.session.completed — no userId in metadata, skipping profile update')
        }
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const firmId = subscription.metadata?.firm_id
        if (firmId) {
          const { data: firmRows } = await supabase
            .from('firms')
            .update({ subscription_status: 'canceled' })
            .eq('id', firmId)
            .select('owner_id')
          console.log('customer.subscription.deleted — firm subscription canceled')
          const ownerId = firmRows?.[0]?.owner_id as string | undefined
          if (ownerId) {
            const { error: profileError } = await supabase
              .from('profiles')
              .update({ subscription_status: 'canceled' })
              .eq('id', ownerId)
            if (profileError) {
              console.error(
                'Failed to update firm owner profile subscription_status:',
                profileError
              )
            }
          }
          break
        }
        const customerId = subscription.customer as string
        await supabase
          .from('profiles')
          .update({ subscription_status: 'canceled' })
          .eq('stripe_customer_id', customerId)
        console.log('customer.subscription.deleted — consumer subscription canceled')

        // Schedule 30-day deletion only for genuine churn (not plan change / role upgrade).
        await scheduleDeletionOnSubscriptionCancelled({
          stripe,
          admin: supabase,
          subscription,
        })
        break
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerIdForReactivation =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id

        if (subscription.status === 'active' && customerIdForReactivation) {
          await cancelPendingDeletionOnReactivation({
            admin: supabase,
            stripeCustomerId: customerIdForReactivation,
          })
        }

        const firmId = subscription.metadata?.firm_id
        if (firmId) {
          const mappedStatus = mapFirmSubscriptionStatus(subscription.status)
          const { data: firmRows } = await supabase
            .from('firms')
            .update({ subscription_status: mappedStatus })
            .eq('id', firmId)
            .select('owner_id')
          console.log('customer.subscription.updated — firm subscription updated:', mappedStatus)
          const ownerId = firmRows?.[0]?.owner_id as string | undefined
          if (ownerId) {
            const { error: profileError } = await supabase
              .from('profiles')
              .update({ subscription_status: mappedStatus })
              .eq('id', ownerId)
            if (profileError) {
              console.error(
                'Failed to update firm owner profile subscription_status:',
                profileError
              )
            }
          }
          break
        }
        const customerId = subscription.customer as string
        const { data: managedRows } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .eq('subscription_status', 'advisor_managed')
          .limit(1)
        if (managedRows?.length) {
          console.log('customer.subscription.updated — skipping advisor_managed profile')
          break
        }
        const renewalIso = new Date(
          subscription.current_period_end * 1000
        ).toISOString()
        await supabase
          .from('profiles')
          .update({
            subscription_status: subscription.status,
            subscription_period_end: renewalIso,
          })
          .eq('stripe_customer_id', customerId)
        console.log('customer.subscription.updated — consumer subscription updated')
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        let firmId =
          invoice.metadata?.firm_id ??
          invoice.subscription_details?.metadata?.firm_id
        // Fallback: retrieve subscription metadata if invoice metadata missing
        if (!firmId && invoice.subscription) {
          try {
            const sub = await stripe.subscriptions.retrieve(invoice.subscription as string)
            firmId = sub.metadata?.firm_id ?? null
          } catch (e) {
            console.error('invoice.payment_failed: failed to retrieve subscription for firm_id fallback', e)
          }
        }
        if (firmId) {
          await supabase
            .from('firms')
            .update({ subscription_status: 'past_due' })
            .eq('id', firmId)
          console.log('invoice.payment_failed — firm marked past_due')
          break
        }
        break
      }
      case 'invoice.upcoming': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId =
          typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
        if (!subscriptionId) break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        if (!customerId || subscription.metadata?.firm_id) break

        try {
          await sendConsumerRenewalReminder(supabase, customerId, subscription, invoice)
          console.log('invoice.upcoming — renewal reminder sent')
        } catch (err) {
          console.error(
            'invoice.upcoming — renewal reminder failed:',
            err instanceof Error ? err.message : err,
          )
        }
        break
      }
    }
  } catch (err) {
    console.error('Webhook error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
  return NextResponse.json({ received: true })
}
