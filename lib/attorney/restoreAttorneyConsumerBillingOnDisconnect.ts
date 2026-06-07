import type { SupabaseClient } from '@supabase/supabase-js'
import {
  restoreManagedConsumerBilling,
  type RestoreManagedConsumerBillingResult,
} from '@/lib/billing/managedConsumerBilling'

export type RestoreAttorneyConsumerBillingParams = {
  clientId: string
  attorneyClientRowId: string
  attorneyListingId?: string
  sendEmail?: boolean
}

export type RestoreAttorneyConsumerBillingResult = RestoreManagedConsumerBillingResult

/** Revert optional attorney-managed consumer billing on disconnect/revoke. */
export async function restoreAttorneyConsumerBillingOnDisconnect(
  admin: SupabaseClient,
  params: RestoreAttorneyConsumerBillingParams,
): Promise<RestoreAttorneyConsumerBillingResult> {
  return restoreManagedConsumerBilling(admin, {
    role: 'attorney',
    clientId: params.clientId,
    linkRowId: params.attorneyClientRowId,
    linkTable: 'attorney_clients',
    professionalId: params.attorneyListingId,
    sendEmail: params.sendEmail,
  })
}
