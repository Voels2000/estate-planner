import type { SupabaseClient } from '@supabase/supabase-js'
import {
  applyManagedConnectionBilling,
  type ApplyManagedConnectionBillingParams,
  type ApplyManagedConnectionBillingResult,
} from '@/lib/billing/managedConsumerBilling'

export type ApplyAdvisorConnectionBillingParams = {
  clientId: string
  advisorClientRowId: string
  skipIfAlreadyTransferred?: boolean
}

export type ApplyAdvisorConnectionBillingResult = ApplyManagedConnectionBillingResult

/**
 * Upgrade a consumer to advisor-managed tier when an advisor connection activates.
 * Controlled by B2B2C_ADVISOR_CONSUMER_BILLING (default on). See docs/BILLING_B2B2C_POLICY.md.
 */
export async function applyAdvisorConnectionBilling(
  admin: SupabaseClient,
  params: ApplyAdvisorConnectionBillingParams,
): Promise<ApplyAdvisorConnectionBillingResult> {
  const managedParams: ApplyManagedConnectionBillingParams = {
    role: 'advisor',
    clientId: params.clientId,
    linkRowId: params.advisorClientRowId,
    linkTable: 'advisor_clients',
    skipIfAlreadyTransferred: params.skipIfAlreadyTransferred,
  }
  return applyManagedConnectionBilling(admin, managedParams)
}
