import {
  REFUND_POLICY_VERSION,
} from '@/lib/legal/plan-export-refund-policy'
import type { ConsumerCheckoutBlock } from '@/lib/billing/b2b2cBillingPolicy'

/** Stripe Checkout session metadata keys — server-stamped at session create. */
export const PLAN_EXPORT_REFUND_ACK_METADATA = {
  version: 'refund_ack_version',
  at: 'refund_ack_at',
} as const

export type PlanExportRefundAck = {
  at: string
  version: string
}

export function getRefundPolicyVersion(): string {
  return REFUND_POLICY_VERSION
}

/** Server gate: checkout must not proceed without explicit client ack signal. */
export function planExportRefundAckBlockReason(
  refundAckAccepted: unknown,
): ConsumerCheckoutBlock | null {
  if (refundAckAccepted === true) return null
  return {
    code: 'refund_ack_required',
    httpStatus: 400,
    message:
      'You must acknowledge the Plan & Export refund policy before continuing to checkout.',
  }
}

/** Stamp server-side at checkout session create — not client-supplied timestamps. */
export function buildPlanExportRefundAckMetadata(): Record<string, string> {
  return {
    [PLAN_EXPORT_REFUND_ACK_METADATA.version]: getRefundPolicyVersion(),
    [PLAN_EXPORT_REFUND_ACK_METADATA.at]: new Date().toISOString(),
  }
}

export function parsePlanExportRefundAckFromMetadata(
  metadata: Record<string, string> | null | undefined,
): PlanExportRefundAck | null {
  const version = metadata?.[PLAN_EXPORT_REFUND_ACK_METADATA.version]?.trim()
  const at = metadata?.[PLAN_EXPORT_REFUND_ACK_METADATA.at]?.trim()
  if (!version || !at || Number.isNaN(Date.parse(at))) return null
  return { version, at }
}
