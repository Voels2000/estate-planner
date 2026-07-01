/** Client-side handling for attorney connection billing gate responses (402). */

import { rateForCount, ATTORNEY_BANDS, ATTORNEY_FLOOR } from '@/lib/pricing/connectionPricing'

export type AttorneyCheckoutRequiredPayload = {
  error: 'attorney_checkout_required'
  quantity: number
}

export type AttorneyLimitRaiseRequiredPayload = {
  error: 'limit_raise_required'
  currentLimit: number
  connected_count: number
}

export type AttorneyConnectBillingGatePayload =
  | AttorneyCheckoutRequiredPayload
  | AttorneyLimitRaiseRequiredPayload
  | { error?: string; quantity?: number; currentLimit?: number; connected_count?: number }

export function isAttorneyCheckoutRequiredPayload(
  data: AttorneyConnectBillingGatePayload,
  status: number,
): data is AttorneyCheckoutRequiredPayload {
  return (
    status === 402 &&
    data.error === 'attorney_checkout_required' &&
    'quantity' in data &&
    typeof (data as AttorneyCheckoutRequiredPayload).quantity === 'number'
  )
}

export function isAttorneyLimitRaiseRequiredPayload(
  data: AttorneyConnectBillingGatePayload,
  status: number,
): data is AttorneyLimitRaiseRequiredPayload {
  return (
    status === 402 &&
    data.error === 'limit_raise_required' &&
    'currentLimit' in data &&
    typeof (data as AttorneyLimitRaiseRequiredPayload).currentLimit === 'number'
  )
}

/** Billable checkout qty from gate — copy for attorney portal modals. */
export function attorneyCheckoutGateCopy(quantity: number): {
  title: string
  body: string
} {
  const rate = rateForCount(quantity, ATTORNEY_BANDS, ATTORNEY_FLOOR)
  const monthly = quantity * rate
  return {
    title: 'Enable client billing',
    body: `Your first client is free. Subscribe for ${quantity} billable client${
      quantity === 1 ? '' : 's'
    } ($${monthly}/mo before tax) to connect another household.`,
  }
}

/** Consumer-facing copy when the attorney must enable billing first. */
export function consumerAttorneyBillingBlockedMessage(
  data: AttorneyConnectBillingGatePayload,
  status: number,
): string | null {
  if (isAttorneyCheckoutRequiredPayload(data, status)) {
    const rate = rateForCount(data.quantity, ATTORNEY_BANDS, ATTORNEY_FLOOR)
    const monthly = data.quantity * rate
    return `Your attorney needs to enable client billing before you can connect (1 client is always free for them; this connection requires a ${data.quantity}-client subscription at about $${monthly}/mo). Ask them to complete checkout in their attorney portal under Billing.`
  }
  if (isAttorneyLimitRaiseRequiredPayload(data, status)) {
    return `Your attorney has reached their client limit (${data.connected_count} of ${data.currentLimit}). Ask them to raise their limit in the attorney portal before you can connect.`
  }
  return null
}
