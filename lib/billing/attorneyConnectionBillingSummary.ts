import {
  ATTORNEY_BANDS,
  ATTORNEY_FLOOR,
  bandForCount,
  rateForCount,
  type ConnectionBand,
} from '@/lib/pricing/connectionPricing'
import {
  MAX_SELF_SERVE_RESETS,
  resolveStickyBillableQuantity,
  buildRebandPreview as buildStickyRebandPreview,
} from '@/lib/billing/firmConnectionStickyFloor'
import type { ConnectionBillingPageState } from '@/lib/billing/firmConnectionBillingSummary'
import {
  formatBandRangeLabel,
  resolveConnectionBillingPageState,
} from '@/lib/billing/firmConnectionBillingSummary'

export type AttorneyConnectionBillingSummary = {
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

export function buildAttorneyConnectionBillingSummary(opts: {
  connectedCount: number
  clientLimit: number | null | undefined
  billingFloor: number | null | undefined
  resetCount: number | null | undefined
}): AttorneyConnectionBillingSummary {
  const connectedCount = Math.max(0, Math.floor(opts.connectedCount))
  const clientLimit = Math.max(1, Math.floor(opts.clientLimit ?? 1))
  const billingFloor = Math.max(0, Math.floor(opts.billingFloor ?? 0))
  const resetCount = Math.max(0, Math.floor(opts.resetCount ?? 0))
  const billableQuantity = resolveStickyBillableQuantity(connectedCount, billingFloor)
  const band = bandForCount(billableQuantity, ATTORNEY_BANDS)
  const ratePerClient = rateForCount(billableQuantity, ATTORNEY_BANDS, ATTORNEY_FLOOR)
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
    canLowerLimit: connectedCount < clientLimit && resetCount < MAX_SELF_SERVE_RESETS,
    canRaiseLimit: true,
  }
}

export function buildAttorneyRaiseLimitPreview(opts: {
  connectedCount: number
  billingFloor: number | null | undefined
  newLimit: number
}) {
  const connectedCount = Math.max(0, Math.floor(opts.connectedCount))
  const billingFloor = Math.max(0, Math.floor(opts.billingFloor ?? 0))
  const newLimit = Math.max(1, Math.floor(opts.newLimit))
  const billableQuantity = resolveStickyBillableQuantity(connectedCount, billingFloor)
  const currentBand = bandForCount(billableQuantity, ATTORNEY_BANDS)
  const newBand = bandForCount(newLimit, ATTORNEY_BANDS)
  const currentRate = rateForCount(billableQuantity, ATTORNEY_BANDS, ATTORNEY_FLOOR)
  const newRate = rateForCount(newLimit, ATTORNEY_BANDS, ATTORNEY_FLOOR)

  return {
    newLimit,
    currentBandLabel: currentBand.label,
    newBandLabel: newBand.label,
    currentRatePerClient: currentRate,
    newRatePerClient: newRate,
    currentMonthly: billableQuantity * currentRate,
    newMonthly: billableQuantity * newRate,
    rateImproved: newRate < currentRate,
    billableQuantity,
  }
}

export function buildAttorneyRebandPreview(opts: {
  currentLimit: number
  newLimit: number
  connectedCount: number
  resetCount: number
}) {
  return buildStickyRebandPreview({
    ...opts,
    bands: ATTORNEY_BANDS,
    rateFloor: ATTORNEY_FLOOR,
  })
}
