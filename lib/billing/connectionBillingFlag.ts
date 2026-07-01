/**
 * Feature flag for connection-based professional billing (Phase 4).
 * Default off — flag-off paths must remain byte-identical to per-seat metering.
 */
export function isConnectionBillingEnabled(): boolean {
  return process.env.CONNECTION_BILLING_ENABLED === 'true'
}
