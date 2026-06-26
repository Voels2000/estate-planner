import { US_ONLY_SUPPORT_EMAIL } from '@/lib/geo/usOnlyAccess'

/** ISO date — stored on one_time_purchases.refund_ack_version when buyers acknowledge. */
export const REFUND_POLICY_VERSION = '2026-06-26'

/**
 * Checkbox label — affirmative acknowledgment before Plan & Export checkout.
 * Counsel review at nexus: "all sales are final / no refunds" vs launch-state digital-goods rules.
 */
export const PLAN_EXPORT_REFUND_ACK_CHECKBOX_LABEL =
  'I understand this is a one-time purchase of a digital deliverable that is generated and made available immediately, and that because of its nature it is non-refundable once delivered.'

/** Full disclosure block (pairs with 90-day edit-window copy in BILLING_DISCLOSURES). */
export function planExportRefundDisclosureParagraph(supportEmail = US_ONLY_SUPPORT_EMAIL): string {
  return (
    'Plan & Export — one-time purchase. This is a single payment for a digital deliverable. ' +
    'Once your purchase is complete, the deliverable is generated and made available to download immediately, ' +
    'and you retain access to edit it for 90 days. Because this is a digital product delivered immediately, ' +
    'all sales are final and we do not offer refunds once the deliverable has been made available. ' +
    `If you have a problem with your purchase, contact us at ${supportEmail} and we'll work with you in good faith to make it right.`
  )
}
