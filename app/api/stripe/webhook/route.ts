import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { sendRenewalReminderEmail } from '@/lib/email/renewalReminderEmail'
import Stripe from 'stripe'
import type { PostgrestError } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createStripeClient } from '@/lib/stripe/config'
import { activateConsumerProfileFromSubscription } from '@/lib/stripe/activateConsumerSubscription'
import { resolveCheckoutSubscription } from '@/lib/stripe/checkoutSubscription'
import { withHasEverSubscribed } from '@/lib/access/hasEverSubscribed'
import { mapConsumerSubscriptionStatus } from '@/lib/stripe/consumerSubscriptionStatus'
import {
  applyPlanAndExportCreditIfEligible,
  fulfillPlanAndExportPurchase,
} from '@/lib/billing/oneTimePurchases'
import { parsePlanExportRefundAckFromMetadata } from '@/lib/billing/planExportRefundAck'
import { isPlanAndExportSku } from '@/lib/billing/stripePrices'
import {
  formatUnixDateEnUs,
  getSubscriptionPeriodEnd,
  subscriptionPeriodEndIso,
} from '@/lib/stripe/subscriptionPeriod'
import {
  resolveInvoiceSubscriptionId,
  resolveStripeCustomerId,
} from '@/lib/stripe/stripeIds'
import { getTierFromPriceId } from '@/lib/billing/stripePrices'
import { FIRM_PRICE_ID_TO_TIER, getAttorneyTierFromPriceId } from '@/lib/tiers'
import { trackTierUpgrade } from '@/lib/analytics/trackUpgrade'
import {
  cancelPendingDeletionOnReactivation,
  scheduleDeletionOnSubscriptionCancelled,
} from '@/lib/compliance/scheduleDeletionOnCancel'
import { rejectNonUsBillingCheckout } from '@/lib/billing/rejectNonUsBillingCheckout'
import {
  applyFirmCheckoutCompletedUpdate,
  buildFirmCheckoutCompletedUpdate,
  buildFirmSubscriptionUpdatedUpdate,
} from '@/lib/billing/firmCheckoutWebhook'
import {
  applyAttorneyListingCheckoutCompletedUpdate,
  buildAttorneyListingCheckoutCompletedUpdate,
  buildAttorneyProfileCheckoutFields,
  buildAttorneySubscriptionUpdatedProfileUpdate,
} from '@/lib/billing/attorneyCheckoutWebhook'
import { isAttorneyConnectionCheckoutPrice } from '@/lib/billing/resolveAttorneyCheckout'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'

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

  const periodEnd = getSubscriptionPeriodEnd(subscription)
  if (periodEnd == null) {
    console.log('invoice.upcoming — no subscription period end, skip renewal reminder')
    return
  }

  const reminderKey = String(periodEnd)
  if (subscription.metadata?.renewal_reminder_sent_for === reminderKey) return

  const line = invoice.lines.data[0]
  const planName =
    (typeof line?.price?.product === 'object' && line.price.product && 'name' in line.price.product
      ? (line.price.product as Stripe.Product).name
      : null) ?? 'My Wealth Maps'
  const price = formatUsdCents(invoice.amount_due ?? line?.amount ?? 0)
  const renewalDate = formatUnixDateEnUs(periodEnd) ?? 'your renewal date'

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
  const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY!)
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

        const rejectedNonUsBilling = await rejectNonUsBillingCheckout(
          stripe,
          session,
          (err) => {
            captureStripeWebhookFailure(
              err instanceof Error ? err : new Error('non-US billing cancel failed'),
              { stage: 'processing', event },
            )
          },
        )
        if (rejectedNonUsBilling) {
          break
        }

        if (session.mode === 'payment') {
          const sku = session.metadata?.sku
          const paymentUserId = session.metadata?.userId
          if (isPlanAndExportSku(sku) && paymentUserId) {
            const amountCents = session.amount_total ?? 0
            const currency = session.currency ?? 'usd'
            const paymentIntentId =
              typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent?.id ?? null

            const refundAck = parsePlanExportRefundAckFromMetadata(session.metadata ?? undefined)
            if (!refundAck) {
              console.error(
                'Plan & Export fulfillment blocked: missing refund acknowledgment in session metadata',
                { sessionId: session.id, userId: paymentUserId, amountCents },
              )
              captureStripeWebhookFailure(
                new Error('Plan & Export fulfillment missing refund acknowledgment'),
                {
                  stage: 'processing',
                  event,
                  extra: {
                    context: 'plan_and_export_fulfillment',
                    sessionId: session.id,
                    userId: paymentUserId,
                    amount_cents: String(amountCents),
                    reason: 'missing_refund_ack_metadata',
                  },
                },
              )
              break
            }

            const { error: fulfillError } = await fulfillPlanAndExportPurchase({
              admin: supabase,
              userId: paymentUserId,
              sessionId: session.id,
              paymentIntentId,
              amountCents,
              currency,
              refundAck,
            })

            if (fulfillError) {
              console.error('Plan & Export fulfillment error:', fulfillError.message)
              captureStripeWebhookFailure(fulfillError, {
                stage: 'processing',
                event,
                extra: {
                  context: 'plan_and_export_fulfillment',
                  sessionId: session.id,
                  userId: paymentUserId,
                  amount_cents: String(amountCents),
                  reason: 'fulfillment_insert_failed',
                },
              })
            }
          } else {
            console.log(
              'checkout.session.completed — payment mode without plan_and_export metadata, skipping',
            )
          }
          break
        }

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
            const update = buildFirmCheckoutCompletedUpdate({
              subscriptionId,
              stripeQuantity,
              priceId,
              firmTier,
            })
            const { ownerId, error } = await applyFirmCheckoutCompletedUpdate(
              supabase,
              firmId,
              update,
            )
            if (error) {
              console.error('Firm Supabase update error:', error)
              captureStripeWebhookFailure(new Error(`Firm checkout update: ${error}`), {
                stage: 'processing',
                event,
              })
            }
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

        const attorneyListingId = session.metadata?.attorney_listing_id
        if (attorneyListingId && isConnectionBillingEnabled()) {
          const subscriptionId = session.subscription as string | null
          const userId = session.metadata?.userId
          if (subscriptionId && userId) {
            const stripeCustomerId = resolveStripeCustomerId(session.customer)
            const sub = await stripe.subscriptions.retrieve(subscriptionId)
            const priceId = sub.items.data[0]?.price.id ?? null
            const stripeQuantity = sub.items.data[0]?.quantity ?? 1
            const listingUpdate = buildAttorneyListingCheckoutCompletedUpdate({
              stripeQuantity,
              priceId,
            })
            const { error: listingError } = await applyAttorneyListingCheckoutCompletedUpdate(
              supabase,
              attorneyListingId,
              listingUpdate,
            )
            if (listingError) {
              console.error('Attorney listing checkout update error:', listingError)
              captureStripeWebhookFailure(new Error(`Attorney listing checkout: ${listingError}`), {
                stage: 'processing',
                event,
              })
            }
            if (stripeCustomerId) {
              const profileFields = buildAttorneyProfileCheckoutFields(
                sub,
                stripeCustomerId,
                priceId,
              )
              const { error: profileError } = await supabase
                .from('profiles')
                .update(profileFields)
                .eq('id', userId)
              if (profileError) {
                console.error('Attorney profile checkout update error:', profileError)
                captureStripeWebhookSupabaseFailure(
                  'attorney connection checkout profile update',
                  profileError,
                  event,
                )
              }
            }
          } else {
            console.log('checkout.session.completed — attorney listing without subscription or userId')
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

          const stripeCustomerId = resolveStripeCustomerId(session.customer)
          if (!stripeCustomerId) {
            console.log('checkout.session.completed — no customer id, skipping profile update')
            break
          }

          const sub = await resolveCheckoutSubscription(stripe, session)
          if (!sub) {
            if (session.mode === 'subscription') {
              console.log(
                'checkout.session.completed — subscription mode but no subscription resolved, skipping activation',
              )
            }
            break
          }

          const { error, fields } = await activateConsumerProfileFromSubscription(
            supabase,
            userId,
            sub,
            stripeCustomerId,
          )
          if (error) {
            console.error('Supabase update error:', error.message)
            captureStripeWebhookSupabaseFailure('consumer checkout profile update', error, event)
          } else if (
            fields?.consumer_tier &&
            fields.consumer_tier > previousTier
          ) {
            void trackTierUpgrade({
              userId,
              tier: fields.consumer_tier,
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
          const { data: firmRows, error: firmError } = await supabase
            .from('firms')
            .update({ subscription_status: 'canceled' })
            .eq('id', firmId)
            .select('owner_id')
          if (firmError) {
            console.error(
              'customer.subscription.deleted — firm update failed:',
              firmError.message,
            )
            captureStripeWebhookSupabaseFailure(
              'firm subscription deleted',
              firmError,
              event,
            )
          }
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
        const customerId = resolveStripeCustomerId(subscription.customer)
        if (!customerId) {
          console.log('customer.subscription.deleted — no customer id, skip consumer update')
          break
        }
        const cancelledPriceId = subscription.items.data[0]?.price.id ?? null
        const attorneyTierCancelled = cancelledPriceId
          ? getAttorneyTierFromPriceId(cancelledPriceId)
          : 0

        const { error: consumerDeleteError } = await supabase
          .from('profiles')
          .update({
            subscription_status: mapConsumerSubscriptionStatus(subscription),
            ...(attorneyTierCancelled > 0 ? { attorney_tier: 0 } : {}),
          })
          .eq('stripe_customer_id', customerId)
        if (consumerDeleteError) {
          console.error(
            'customer.subscription.deleted — consumer profile update failed:',
            consumerDeleteError.message,
          )
          captureStripeWebhookSupabaseFailure(
            'consumer profile subscription deleted',
            consumerDeleteError,
            event,
          )
        }
        console.log('customer.subscription.deleted — consumer subscription canceled')

        // Schedule 30-day deletion only for genuine churn (not plan change / role upgrade).
        await scheduleDeletionOnSubscriptionCancelled({
          stripe,
          admin: supabase,
          subscription,
        })
        break
      }
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        if (subscription.metadata?.firm_id) {
          break
        }

        const customerId = resolveStripeCustomerId(subscription.customer)
        if (!customerId) {
          console.log('customer.subscription.created — no customer id, skipping activation')
          break
        }

        const { data: managedRows } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .in('subscription_status', ['advisor_managed', 'attorney_managed'])
          .limit(1)
        if (managedRows?.length) {
          console.log('customer.subscription.created — skipping managed B2B2C profile')
          break
        }

        let userId = subscription.metadata?.userId as string | undefined
        if (!userId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle()
          userId = profile?.id
        }
        if (!userId) {
          console.log('customer.subscription.created — no profile for customer, skipping activation')
          break
        }

        const { data: priorProfile } = await supabase
          .from('profiles')
          .select('consumer_tier')
          .eq('id', userId)
          .single()
        const previousTier = priorProfile?.consumer_tier ?? 0

        const { error, fields } = await activateConsumerProfileFromSubscription(
          supabase,
          userId,
          subscription,
          customerId,
        )
        if (error) {
          console.error('customer.subscription.created — profile update failed:', error.message)
          captureStripeWebhookSupabaseFailure('consumer subscription created', error, event)
        } else if (fields?.consumer_tier && fields.consumer_tier > previousTier) {
          void trackTierUpgrade({
            userId,
            tier: fields.consumer_tier,
            previousTier,
          })
        } else {
          console.log('customer.subscription.created — consumer subscription activated')
        }

        const { error: creditError } = await applyPlanAndExportCreditIfEligible({
          admin: supabase,
          stripe,
          userId,
          stripeCustomerId: customerId,
        })
        if (creditError) {
          console.error(
            'customer.subscription.created — Plan & Export credit failed:',
            creditError.message,
          )
          captureStripeWebhookFailure(creditError, {
            stage: 'processing',
            event,
            extra: { context: 'plan_and_export_credit' },
          })
        }
        break
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerIdForReactivation = resolveStripeCustomerId(subscription.customer)

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
          const firmUpdate = buildFirmSubscriptionUpdatedUpdate({
            mappedStatus,
            stripeQuantity,
            stripePriceId,
            firmTier,
          })
          const { data: firmRows, error: firmError } = await supabase
            .from('firms')
            .update(firmUpdate)
            .eq('id', firmId)
            .select('owner_id')
          if (firmError) {
            console.error(
              'customer.subscription.updated — firm update failed:',
              firmError.message,
            )
            captureStripeWebhookSupabaseFailure(
              'firm subscription updated',
              firmError,
              event,
            )
          }
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

        const attorneyListingId = subscription.metadata?.attorney_listing_id
        if (attorneyListingId) {
          const mappedStatus = subscription.cancel_at_period_end
            ? 'canceling'
            : mapConsumerSubscriptionStatus(subscription)
          const stripePriceId = subscription.items.data[0]?.price?.id
          const profileUpdate = buildAttorneySubscriptionUpdatedProfileUpdate({
            mappedStatus,
            priceId: stripePriceId,
          })
          const attorneyUserId = subscription.metadata?.userId
          if (attorneyUserId) {
            const { error: profileError } = await supabase
              .from('profiles')
              .update({
                ...profileUpdate,
                stripe_subscription_id: subscription.id,
              })
              .eq('id', attorneyUserId)
            if (profileError) {
              console.error(
                'customer.subscription.updated — attorney profile update failed:',
                profileError.message,
              )
              captureStripeWebhookSupabaseFailure(
                'attorney subscription updated',
                profileError,
                event,
              )
            }
          }
          console.log('customer.subscription.updated — attorney connection subscription updated')
          break
        }

        const customerId = resolveStripeCustomerId(subscription.customer)
        if (!customerId) {
          console.log('customer.subscription.updated — no customer id, skip consumer update')
          break
        }
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
        const renewalIso = subscriptionPeriodEndIso(subscription)
        const priceId = subscription.items.data[0]?.price.id ?? null
        const consumerTier = priceId ? getTierFromPriceId(priceId) : null
        const attorneyTier = priceId ? getAttorneyTierFromPriceId(priceId) : 0
        const isAttorneyConnectionPrice =
          priceId != null && isAttorneyConnectionCheckoutPrice(priceId)
        const status = mapConsumerSubscriptionStatus(subscription)
        const consumerUpdate = withHasEverSubscribed({
          subscription_status: status,
          stripe_subscription_id: subscription.id,
          ...(renewalIso != null ? { subscription_period_end: renewalIso } : {}),
          ...(priceId ? { subscription_plan: priceId } : {}),
          ...(consumerTier ? { consumer_tier: consumerTier } : {}),
          ...(attorneyTier > 0 && !isAttorneyConnectionPrice ? { attorney_tier: attorneyTier } : {}),
        })
        const { error: consumerUpdateError } = await supabase
          .from('profiles')
          .update(consumerUpdate)
          .eq('stripe_customer_id', customerId)
        if (consumerUpdateError) {
          console.error(
            'customer.subscription.updated — consumer profile update failed:',
            consumerUpdateError.message,
          )
          captureStripeWebhookSupabaseFailure(
            'consumer profile subscription updated',
            consumerUpdateError,
            event,
          )
        }
        console.log('customer.subscription.updated — consumer subscription updated')
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        let firmId =
          invoice.metadata?.firm_id ??
          invoice.subscription_details?.metadata?.firm_id
        // Fallback: retrieve subscription metadata if invoice metadata missing
        if (!firmId) {
          const subscriptionId = resolveInvoiceSubscriptionId(invoice)
          if (subscriptionId) {
            try {
              const sub = await stripe.subscriptions.retrieve(subscriptionId)
              firmId = sub.metadata?.firm_id ?? null
            } catch (e) {
              console.error(
                'invoice.payment_failed: failed to retrieve subscription for firm_id fallback',
                e,
              )
              captureStripeWebhookFailure(
                new Error('invoice.payment_failed subscription retrieve failed'),
                { stage: 'processing', event },
              )
            }
          }
        }
        if (firmId) {
          const { error: firmPastDueError } = await supabase
            .from('firms')
            .update({ subscription_status: 'past_due' })
            .eq('id', firmId)
          if (firmPastDueError) {
            console.error(
              'invoice.payment_failed — firm update failed:',
              firmPastDueError.message,
            )
            captureStripeWebhookSupabaseFailure(
              'firm invoice payment failed',
              firmPastDueError,
              event,
            )
          }

          const { data: firm } = await supabase
            .from('firms')
            .select('owner_id')
            .eq('id', firmId)
            .single()
          if (firm?.owner_id) {
            const { error: ownerPastDueError } = await supabase
              .from('profiles')
              .update({ subscription_status: 'past_due' })
              .eq('id', firm.owner_id)
            if (ownerPastDueError) {
              console.error(
                'invoice.payment_failed — firm owner profile update failed:',
                ownerPastDueError.message,
              )
              captureStripeWebhookSupabaseFailure(
                'firm owner profile invoice payment failed',
                ownerPastDueError,
                event,
              )
            }
          }

          console.log('invoice.payment_failed — firm marked past_due')
          break
        }

        const customerId = resolveStripeCustomerId(invoice.customer)
        if (customerId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, stripe_customer_id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle()
          if (profile) {
            const { error: consumerPastDueError } = await supabase
              .from('profiles')
              .update({ subscription_status: 'past_due' })
              .eq('id', profile.id)
            if (consumerPastDueError) {
              console.error(
                'invoice.payment_failed — consumer profile update failed:',
                consumerPastDueError.message,
              )
              captureStripeWebhookSupabaseFailure(
                'consumer profile invoice payment failed',
                consumerPastDueError,
                event,
              )
            }
            console.log('invoice.payment_failed — consumer profile marked past_due')
          }
        }
        break
      }
      case 'invoice.upcoming': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = resolveInvoiceSubscriptionId(invoice)
        if (!subscriptionId) break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const customerId = resolveStripeCustomerId(invoice.customer)
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
