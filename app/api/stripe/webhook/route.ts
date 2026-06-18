import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { sendRenewalReminderEmail } from '@/lib/email/renewalReminderEmail'
import Stripe from 'stripe'
import type { PostgrestError } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTierFromPriceId } from '@/lib/billing/stripePrices'
import { FIRM_PRICE_ID_TO_TIER, getAttorneyTierFromPriceId } from '@/lib/tiers'
import { trackTierUpgrade } from '@/lib/analytics/trackUpgrade'
import {
  cancelPendingDeletionOnReactivation,
  scheduleDeletionOnSubscriptionCancelled,
} from '@/lib/compliance/scheduleDeletionOnCancel'

type WebhookCaptureStage = 'signature' | 'handler' | 'processing'

function captureStripeWebhookFailure(
  err: Error,
  opts: {
    stage: WebhookCaptureStage
    event?: Stripe.Event
    level?: 'warning' | 'error'
    extra?: Record<string, string>
  },
) {
  const level =
    opts.level ?? (opts.stage === 'signature' ? 'warning' : 'error')
  Sentry.captureException(err, {
    level,
    tags: {
      area: 'stripe_webhook',
      stage: opts.stage,
      ...(opts.event ? { stripe_event_type: opts.event.type } : {}),
    },
    extra: {
      ...(opts.event ? { stripe_event_id: opts.event.id } : {}),
      ...opts.extra,
    },
  })
}

/** Postgrest `details`/`hint`/`message` may echo row values — attach pg_code only. */
function captureStripeWebhookSupabaseFailure(
  context: string,
  dbError: Pick<PostgrestError, 'code'>,
  event: Stripe.Event,
) {
  captureStripeWebhookFailure(new Error(`Supabase ${context} failed`), {
    stage: 'processing',
    event,
    ...(dbError.code ? { extra: { pg_code: dbError.code } } : {}),
  })
}

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
  stripe: Stripe,
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
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
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
    captureStripeWebhookFailure(new Error('Webhook signature verification failed'), {
      stage: 'signature',
    })
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
            const stripeQuantity = sub.items.data[0]?.quantity ?? 1
            const firmTier = priceId
              ? FIRM_PRICE_ID_TO_TIER[priceId]
              : undefined
            const update: {
              stripe_subscription_id: string
              subscription_status: 'active'
              seat_count: number
              tier?: string
            } = {
              stripe_subscription_id: subscriptionId,
              subscription_status: 'active',
              seat_count: stripeQuantity,
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
              captureStripeWebhookSupabaseFailure('firm checkout update', error, event)
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
                captureStripeWebhookSupabaseFailure(
                  'firm owner profile checkout update',
                  profileError,
                  event,
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
          let subscriptionStatus: Stripe.Subscription.Status = 'active'
          if (subId) {
            const sub = await stripe.subscriptions.retrieve(subId)
            subscriptionStatus = sub.status
            renewalIso = new Date(sub.current_period_end * 1000).toISOString()
            priceId = sub.items.data[0]?.price.id ?? null
            consumerTier = priceId ? getTierFromPriceId(priceId) : null
          }
          const attorneyTier = priceId ? getAttorneyTierFromPriceId(priceId) : 0
          const { error } = await supabase
            .from('profiles')
            .update({
              subscription_status: subscriptionStatus,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: subId,
              subscription_plan: priceId,
              ...(consumerTier ? { consumer_tier: consumerTier } : {}),
              ...(attorneyTier > 0 ? { attorney_tier: attorneyTier } : {}),
              ...(renewalIso ? { subscription_period_end: renewalIso } : {}),
            })
            .eq('id', userId)
          if (error) {
            console.error('Supabase update error:', error.message)
            captureStripeWebhookSupabaseFailure('consumer checkout profile update', error, event)
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
              captureStripeWebhookSupabaseFailure(
                'firm owner profile subscription deleted',
                profileError,
                event,
              )
            }
          }
          break
        }
        const customerId = subscription.customer as string
        const cancelledPriceId = subscription.items.data[0]?.price.id ?? null
        const attorneyTierCancelled = cancelledPriceId
          ? getAttorneyTierFromPriceId(cancelledPriceId)
          : 0

        await supabase
          .from('profiles')
          .update({
            subscription_status: 'canceled',
            ...(attorneyTierCancelled > 0 ? { attorney_tier: 0 } : {}),
          })
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
          const mappedStatus = subscription.cancel_at_period_end
            ? 'canceling'
            : mapFirmSubscriptionStatus(subscription.status)
          const stripeQuantity = subscription.items.data[0]?.quantity ?? 1
          const stripePriceId = subscription.items.data[0]?.price?.id
          const firmTier = stripePriceId
            ? FIRM_PRICE_ID_TO_TIER[stripePriceId]
            : undefined
          const { data: firmRows } = await supabase
            .from('firms')
            .update({
              subscription_status: mappedStatus,
              seat_count: stripeQuantity,
              ...(firmTier ? { tier: firmTier } : {}),
            })
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
              captureStripeWebhookSupabaseFailure(
                'firm owner profile subscription updated',
                profileError,
                event,
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
          .in('subscription_status', ['advisor_managed', 'attorney_managed'])
          .limit(1)
        if (managedRows?.length) {
          console.log('customer.subscription.updated — skipping managed B2B2C profile')
          break
        }
        const renewalIso = new Date(
          subscription.current_period_end * 1000
        ).toISOString()
        const priceId = subscription.items.data[0]?.price.id ?? null
        const consumerTier = priceId ? getTierFromPriceId(priceId) : null
        const attorneyTier = priceId ? getAttorneyTierFromPriceId(priceId) : 0
        const status = subscription.cancel_at_period_end
          ? 'canceling'
          : subscription.status
        await supabase
          .from('profiles')
          .update({
            subscription_status: status,
            subscription_period_end: renewalIso,
            ...(priceId ? { subscription_plan: priceId } : {}),
            ...(consumerTier ? { consumer_tier: consumerTier } : {}),
            ...(attorneyTier > 0 ? { attorney_tier: attorneyTier } : {}),
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
            captureStripeWebhookFailure(
              new Error('invoice.payment_failed subscription retrieve failed'),
              { stage: 'processing', event },
            )
          }
        }
        if (firmId) {
          await supabase
            .from('firms')
            .update({ subscription_status: 'past_due' })
            .eq('id', firmId)

          const { data: firm } = await supabase
            .from('firms')
            .select('owner_id')
            .eq('id', firmId)
            .single()
          if (firm?.owner_id) {
            await supabase
              .from('profiles')
              .update({ subscription_status: 'past_due' })
              .eq('id', firm.owner_id)
          }

          console.log('invoice.payment_failed — firm marked past_due')
          break
        }

        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        if (customerId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, stripe_customer_id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle()
          if (profile) {
            await supabase
              .from('profiles')
              .update({ subscription_status: 'past_due' })
              .eq('id', profile.id)
            console.log('invoice.payment_failed — consumer profile marked past_due')
          }
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
          await sendConsumerRenewalReminder(stripe, supabase, customerId, subscription, invoice)
          console.log('invoice.upcoming — renewal reminder sent')
        } catch (err) {
          console.error(
            'invoice.upcoming — renewal reminder failed:',
            err instanceof Error ? err.message : err,
          )
          captureStripeWebhookFailure(new Error('invoice.upcoming renewal reminder failed'), {
            stage: 'processing',
            event,
            level: 'warning',
          })
        }
        break
      }
    }
  } catch (err) {
    console.error('Webhook error:', err instanceof Error ? err.message : err)
    captureStripeWebhookFailure(new Error('Webhook handler failed'), {
      stage: 'handler',
      event,
    })
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
  return NextResponse.json({ received: true })
}
