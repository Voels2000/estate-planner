import type { SupabaseClient } from '@supabase/supabase-js'
import {
  restoreManagedConsumerBilling,
  type RestoreManagedConsumerBillingResult,
} from '@/lib/billing/managedConsumerBilling'

export type RestoreConsumerBillingParams = {
  clientId: string
  advisorClientRowId: string
  advisorId?: string
  sendEmail?: boolean
}

export type RestoreConsumerBillingResult = RestoreManagedConsumerBillingResult

/**
 * Revert consumer billing when an advisor connection ends.
 * Only restores tier/Stripe when B2B2C handoff had been applied.
 */
export async function restoreConsumerBillingOnDisconnect(
  admin: SupabaseClient,
  params: RestoreConsumerBillingParams,
): Promise<RestoreConsumerBillingResult> {
  return restoreManagedConsumerBilling(admin, {
    role: 'advisor',
    clientId: params.clientId,
    linkRowId: params.advisorClientRowId,
    linkTable: 'advisor_clients',
    professionalId: params.advisorId,
    sendEmail: params.sendEmail,
  })
}
