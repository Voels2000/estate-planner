import type { SupabaseClient } from '@supabase/supabase-js'
import { sendAdvisorDisconnectResubscribeEmail } from '@/lib/email/advisorDisconnectResubscribeEmail'
import { getAppUrl } from '@/lib/app-url'
import {
  type B2b2cProfessionalRole,
  isConsumerBillingHandoffEnabled,
  managedConsumerTier,
  managedSubscriptionPlan,
  managedSubscriptionStatus,
} from '@/lib/billing/b2b2cBillingPolicy'
import {
  pauseActiveStripeSubscriptionAtPeriodEnd,
  resumePausedStripeSubscription,
} from '@/lib/billing/stripeSubscriptionLifecycle'

export type ConnectionLinkTable = 'advisor_clients' | 'attorney_clients'

export type ApplyManagedConnectionBillingParams = {
  role: B2b2cProfessionalRole
  clientId: string
  linkRowId: string
  linkTable: ConnectionLinkTable
  skipIfAlreadyTransferred?: boolean
}

export type ApplyManagedConnectionBillingResult = {
  ok: boolean
  previousTier: number
  cancelAt: string | null
  billingTransferred: boolean
  handoffEnabled: boolean
}

export type RestoreManagedConsumerBillingParams = {
  role: B2b2cProfessionalRole
  clientId: string
  linkRowId: string
  linkTable: ConnectionLinkTable
  professionalId?: string
  sendEmail?: boolean
}

export type RestoreManagedConsumerBillingResult = {
  ok: boolean
  restoredTier: number
  stripeResumed: boolean
}

export async function applyManagedConnectionBilling(
  admin: SupabaseClient,
  params: ApplyManagedConnectionBillingParams,
): Promise<ApplyManagedConnectionBillingResult> {
  const { role, clientId, linkRowId, linkTable, skipIfAlreadyTransferred = false } = params
  const handoffEnabled = isConsumerBillingHandoffEnabled(role)

  const { data: linkRow } = await admin
    .from(linkTable)
    .select('billing_transferred')
    .eq('id', linkRowId)
    .maybeSingle()

  if (skipIfAlreadyTransferred && linkRow?.billing_transferred) {
    return {
      ok: true,
      previousTier: managedConsumerTier(role),
      cancelAt: null,
      billingTransferred: true,
      handoffEnabled,
    }
  }

  const { data: consumerProfile } = await admin
    .from('profiles')
    .select('consumer_tier, stripe_customer_id, role, subscription_status')
    .eq('id', clientId)
    .single()

  const previousTier = consumerProfile?.consumer_tier ?? 1

  if (!consumerProfile || (consumerProfile.role && consumerProfile.role !== 'consumer')) {
    return {
      ok: false,
      previousTier,
      cancelAt: null,
      billingTransferred: false,
      handoffEnabled,
    }
  }

  if (!handoffEnabled) {
    return {
      ok: true,
      previousTier,
      cancelAt: null,
      billingTransferred: false,
      handoffEnabled: false,
    }
  }

  const managedStatus = managedSubscriptionStatus(role)
  const targetTier = managedConsumerTier(role)

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      consumer_tier: targetTier,
      subscription_status: managedStatus,
      subscription_plan: managedSubscriptionPlan(role),
    })
    .eq('id', clientId)

  if (profileError) {
    console.error(`applyManagedConnectionBilling (${role}) profile update:`, profileError)
    return { ok: false, previousTier, cancelAt: null, billingTransferred: false, handoffEnabled }
  }

  let cancelAt: string | null = null
  let billingTransferred = true

  if (consumerProfile.stripe_customer_id) {
    const pause = await pauseActiveStripeSubscriptionAtPeriodEnd(consumerProfile.stripe_customer_id)
    cancelAt = pause.cancelAt
    if (!pause.ok) {
      billingTransferred = false
    }
  }

  const { error: linkError } = await admin
    .from(linkTable)
    .update({
      previous_consumer_tier: previousTier,
      billing_transferred: billingTransferred,
      billing_transferred_at: new Date().toISOString(),
      consumer_subscription_cancel_at: cancelAt,
    })
    .eq('id', linkRowId)

  if (linkError) {
    console.error(`applyManagedConnectionBilling (${role}) link update:`, linkError)
  }

  return { ok: true, previousTier, cancelAt, billingTransferred, handoffEnabled }
}

export async function restoreManagedConsumerBilling(
  admin: SupabaseClient,
  params: RestoreManagedConsumerBillingParams,
): Promise<RestoreManagedConsumerBillingResult> {
  const { role, clientId, linkRowId, linkTable, professionalId, sendEmail = true } = params
  const managedStatus = managedSubscriptionStatus(role)

  const { data: linkRow } = await admin
    .from(linkTable)
    .select('billing_transferred, previous_consumer_tier')
    .eq('id', linkRowId)
    .maybeSingle()

  const { data: consumerProfile } = await admin
    .from('profiles')
    .select('email, full_name, consumer_tier, subscription_status, stripe_customer_id, role')
    .eq('id', clientId)
    .maybeSingle()

  if (!consumerProfile || (consumerProfile.role && consumerProfile.role !== 'consumer')) {
    return { ok: false, restoredTier: consumerProfile?.consumer_tier ?? 1, stripeResumed: false }
  }

  const restoredTier =
    linkRow?.billing_transferred && linkRow.previous_consumer_tier != null
      ? linkRow.previous_consumer_tier
      : consumerProfile.subscription_status === managedStatus
        ? 1
        : (consumerProfile.consumer_tier ?? 1)

  const hadManagedBilling = consumerProfile.subscription_status === managedStatus

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      consumer_tier: restoredTier,
      subscription_status: 'none',
      subscription_plan: null,
    })
    .eq('id', clientId)

  if (profileError) {
    console.error(`restoreManagedConsumerBilling (${role}) profile update:`, profileError)
    return { ok: false, restoredTier, stripeResumed: false }
  }

  let stripeResumed = false
  if (consumerProfile.stripe_customer_id && hadManagedBilling) {
    stripeResumed = await resumePausedStripeSubscription(consumerProfile.stripe_customer_id)
  }

  await admin
    .from(linkTable)
    .update({
      billing_transferred: false,
      consumer_subscription_cancel_at: null,
    })
    .eq('id', linkRowId)

  if (sendEmail && consumerProfile.email && role === 'advisor') {
    const appUrl = getAppUrl()
    const needsResubscribe = hadManagedBilling && restoredTier < 3 && !stripeResumed

    void sendAdvisorDisconnectResubscribeEmail({
      to: consumerProfile.email,
      firstName: consumerProfile.full_name?.split(' ')[0] ?? 'there',
      needsResubscribe,
      billingUrl: `${appUrl}/billing?plan=estate`,
      dashboardUrl: `${appUrl}/dashboard`,
    }).catch((err) => {
      console.error('disconnect resubscribe email:', err)
    })
  }

  const professionalLabel = role === 'advisor' ? 'Advisor' : 'Attorney'
  try {
    await admin.rpc('create_notification', {
      p_user_id: clientId,
      p_type: 'estate_milestone',
      p_title: `${professionalLabel} connection ended`,
      p_body: stripeResumed
        ? `Your ${role} connection has ended. Your previous subscription will continue.`
        : restoredTier < managedConsumerTier(role)
          ? `Your ${role} connection has ended. Subscribe to keep full planning access.`
          : `Your ${role} connection has ended. Your account access has been updated.`,
      p_delivery: 'both',
      p_metadata: {
        professional_id: professionalId ?? null,
        restored_tier: restoredTier,
        stripe_resumed: stripeResumed,
        role,
      },
      p_cooldown: '1 hour',
    })
  } catch {}

  return { ok: true, restoredTier, stripeResumed }
}
