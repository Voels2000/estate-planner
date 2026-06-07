import type { SupabaseClient } from '@supabase/supabase-js'
import {
  applyManagedConnectionBilling,
  type ApplyManagedConnectionBillingResult,
} from '@/lib/billing/managedConsumerBilling'

export type ApplyAttorneyConnectionBillingParams = {
  clientId: string
  attorneyClientRowId: string
  skipIfAlreadyTransferred?: boolean
}

export type ApplyAttorneyConnectionBillingResult = ApplyManagedConnectionBillingResult

/**
 * Optional consumer billing handoff when an attorney connection activates.
 * Off by default — set B2B2C_ATTORNEY_CONSUMER_BILLING=true to enable.
 */
export async function applyAttorneyConnectionBilling(
  admin: SupabaseClient,
  params: ApplyAttorneyConnectionBillingParams,
): Promise<ApplyAttorneyConnectionBillingResult> {
  return applyManagedConnectionBilling(admin, {
    role: 'attorney',
    clientId: params.clientId,
    linkRowId: params.attorneyClientRowId,
    linkTable: 'attorney_clients',
    skipIfAlreadyTransferred: params.skipIfAlreadyTransferred,
  })
}
