import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import {
  computePlanExportEditWindowEndsAt,
  type PlanExportPurchaseContext,
} from '@/lib/billing/planExportAccess'
import {
  ONE_TIME_SKU_META,
  PLAN_AND_EXPORT_SKU,
} from '@/lib/billing/stripePrices'

export type OneTimePurchaseRow = {
  id: string
  user_id: string
  sku: string
  stripe_checkout_session_id: string
  stripe_payment_intent_id: string | null
  amount_cents: number
  currency: string
  status: string
  credit_applied_at: string | null
  purchased_at: string
  edit_window_ends_at: string
  warning_14d_sent_at: string | null
  warning_3d_sent_at: string | null
  refund_ack_at: string | null
  refund_ack_version: string | null
  created_at: string
}

export async function getUserPlanExportPurchase(
  admin: SupabaseClient,
  userId: string,
): Promise<OneTimePurchaseRow | null> {
  const { data } = await admin
    .from('one_time_purchases')
    .select('*')
    .eq('user_id', userId)
    .eq('sku', PLAN_AND_EXPORT_SKU)
    .eq('status', 'completed')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data
}

export function toPlanExportPurchaseContext(
  row: Pick<OneTimePurchaseRow, 'edit_window_ends_at'> | null | undefined,
): PlanExportPurchaseContext | null {
  if (!row?.edit_window_ends_at) return null
  return { editWindowEndsAt: row.edit_window_ends_at }
}

export type FulfillPlanAndExportInput = {
  admin: SupabaseClient
  userId: string
  sessionId: string
  paymentIntentId: string | null
  amountCents: number
  currency: string
  fulfilledAt?: Date
  refundAck: { at: string; version: string }
}

/** Idempotent insert keyed on stripe_checkout_session_id. Returns true if a new row was created. */
export async function fulfillPlanAndExportPurchase(
  input: FulfillPlanAndExportInput,
): Promise<{ created: boolean; error: Error | null }> {
  if (!input.refundAck?.at || !input.refundAck?.version) {
    return {
      created: false,
      error: new Error('Plan & Export fulfillment missing refund acknowledgment metadata'),
    }
  }

  const purchasedAt = input.fulfilledAt ?? new Date()
  const editWindowEndsAt = computePlanExportEditWindowEndsAt(purchasedAt)

  const { error } = await input.admin.from('one_time_purchases').insert({
    user_id: input.userId,
    sku: PLAN_AND_EXPORT_SKU,
    stripe_checkout_session_id: input.sessionId,
    stripe_payment_intent_id: input.paymentIntentId,
    amount_cents: input.amountCents,
    currency: input.currency,
    status: 'completed',
    purchased_at: purchasedAt.toISOString(),
    edit_window_ends_at: editWindowEndsAt.toISOString(),
    refund_ack_at: input.refundAck.at,
    refund_ack_version: input.refundAck.version,
  })

  if (!error) {
    return { created: true, error: null }
  }

  if (error.code === '23505') {
    return { created: false, error: null }
  }

  return { created: false, error: new Error(error.message) }
}

export type ApplyPlanAndExportCreditStripe = Pick<Stripe, 'customers'>

export type ApplyPlanAndExportCreditInput = {
  admin: SupabaseClient
  stripe: ApplyPlanAndExportCreditStripe
  userId: string
  stripeCustomerId: string
}

/**
 * Apply full Plan & Export purchase amount as customer balance credit, exactly once.
 * Tier 3 annual: first invoice nets to $0. Tier 3 monthly: credit draws down over ~10 invoices.
 *
 * Fail-closed credit ordering: `credit_applied_at` is committed before the Stripe balance
 * transaction. If the process dies after the UPDATE but before Stripe responds, the row stays
 * consumed with no credit applied — support can replay manually; double-credit is impossible.
 */
export async function applyPlanAndExportCreditIfEligible(
  input: ApplyPlanAndExportCreditInput,
): Promise<{ applied: boolean; error: Error | null }> {
  const { data: purchase } = await input.admin
    .from('one_time_purchases')
    .select('id, amount_cents, currency, credit_applied_at')
    .eq('user_id', input.userId)
    .eq('sku', PLAN_AND_EXPORT_SKU)
    .eq('status', 'completed')
    .is('credit_applied_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!purchase) {
    return { applied: false, error: null }
  }

  const { data: consumed, error: consumeError } = await input.admin
    .from('one_time_purchases')
    .update({ credit_applied_at: new Date().toISOString() })
    .eq('id', purchase.id)
    .is('credit_applied_at', null)
    .select('id')
    .maybeSingle()

  if (consumeError) {
    return { applied: false, error: new Error(consumeError.message) }
  }
  if (!consumed) {
    return { applied: false, error: null }
  }

  const currency = purchase.currency || 'usd'
  try {
    await input.stripe.customers.createBalanceTransaction(input.stripeCustomerId, {
      amount: -purchase.amount_cents,
      currency,
      description: 'Plan & Export credit toward subscription',
    })
  } catch (err) {
    await input.admin
      .from('one_time_purchases')
      .update({ credit_applied_at: null })
      .eq('id', purchase.id)
    return {
      applied: false,
      error: err instanceof Error ? err : new Error('Stripe balance credit failed'),
    }
  }

  return { applied: true, error: null }
}

export function planAndExportAmountCents(): number {
  return ONE_TIME_SKU_META.PLAN_AND_EXPORT.amountCents
}
