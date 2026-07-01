import {
  ADVISOR_BANDS,
  ADVISOR_FLOOR,
  bandForCount,
  rateForCount,
  type ConnectionBand,
} from '@/lib/pricing/connectionPricing'
import {
  MAX_SELF_SERVE_RESETS,
  resolveStickyBillableQuantity,
} from '@/lib/billing/firmConnectionStickyFloor'
import { buildConnectionRaiseLimitPreview, type ConnectionRaiseLimitPreview } from '@/lib/billing/connectionRaiseLimitPreview'

export type ConnectionBillingPageState =
  | 'below_capacity'
  | 'at_capacity'
  | 'floor_above_connected'

export type FirmConnectionBillingSummary = {
  connectedCount: number
  clientLimit: number
  billingFloor: number
  billableQuantity: number
  bandLabel: string
  bandRangeLabel: string
  ratePerClient: number
  estimatedMonthly: number
  resetCount: number
  selfServeResetsRemaining: number
  pageState: ConnectionBillingPageState
  planLine: string
  connectedCapacityLine: string
  canLowerLimit: boolean
  canRaiseLimit: boolean
}

export function formatBandRangeLabel(band: Pick<ConnectionBand, 'lo' | 'hi'>): string {
  if (!Number.isFinite(band.hi)) return `${band.lo}+ clients`
  return `${band.lo}–${band.hi} clients`
}

export function resolveConnectionBillingPageState(
  connectedCount: number,
  clientLimit: number,
  billingFloor: number,
): ConnectionBillingPageState {
  const connected = Math.max(0, Math.floor(connectedCount))
  const limit = Math.max(1, Math.floor(clientLimit))
  const floor = Math.max(0, Math.floor(billingFloor))
  if (connected >= limit) return 'at_capacity'
  if (floor > connected) return 'floor_above_connected'
  return 'below_capacity'
}

export function buildFirmConnectionBillingSummary(opts: {
  connectedCount: number
  clientLimit: number | null | undefined
  billingFloor: number | null | undefined
  resetCount: number | null | undefined
}): FirmConnectionBillingSummary {
  const connectedCount = Math.max(0, Math.floor(opts.connectedCount))
  const clientLimit = Math.max(1, Math.floor(opts.clientLimit ?? 1))
  const billingFloor = Math.max(0, Math.floor(opts.billingFloor ?? 0))
  const resetCount = Math.max(0, Math.floor(opts.resetCount ?? 0))
  const billableQuantity = resolveStickyBillableQuantity(connectedCount, billingFloor)
  const band = bandForCount(billableQuantity, ADVISOR_BANDS)
  const ratePerClient = rateForCount(billableQuantity, ADVISOR_BANDS, ADVISOR_FLOOR)
  const estimatedMonthly = billableQuantity * ratePerClient
  const pageState = resolveConnectionBillingPageState(connectedCount, clientLimit, billingFloor)
  const rangeLabel = formatBandRangeLabel(band)

  return {
    connectedCount,
    clientLimit,
    billingFloor,
    billableQuantity,
    bandLabel: band.label,
    bandRangeLabel: rangeLabel,
    ratePerClient,
    estimatedMonthly,
    resetCount,
    selfServeResetsRemaining: Math.max(0, MAX_SELF_SERVE_RESETS - resetCount),
    pageState,
    planLine: `Connection billing — ${band.label} band (${rangeLabel})`,
    connectedCapacityLine: `${connectedCount} of ${clientLimit} client capacity`,
    canLowerLimit:
      connectedCount < clientLimit && resetCount < MAX_SELF_SERVE_RESETS,
    canRaiseLimit: true,
  }
}

export type RaiseLimitPreview = ConnectionRaiseLimitPreview

/** Preview raising headroom — billable qty unchanged until new clients connect. */
export function buildRaiseLimitPreview(opts: {
  connectedCount: number
  billingFloor: number | null | undefined
  newLimit: number
}): RaiseLimitPreview {
  return buildConnectionRaiseLimitPreview({
    connectedCount: opts.connectedCount,
    billingFloor: opts.billingFloor,
    newLimit: opts.newLimit,
    bands: ADVISOR_BANDS,
    rateFloor: ADVISOR_FLOOR,
    billableQuantity: resolveStickyBillableQuantity,
    bandCountForNewLimit: (limit) => limit,
    billableAfterOneMoreConnect: (connected) => connected + 1,
  })
}
