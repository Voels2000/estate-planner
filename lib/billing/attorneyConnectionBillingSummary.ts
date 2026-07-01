import {
  ATTORNEY_BANDS,
  ATTORNEY_FLOOR,
  bandForCount,
  rateForCount,
} from '@/lib/pricing/connectionPricing'
import {
  ATTORNEY_FREE_CLIENTS,
  attorneyBillableBeforeFloor,
  resolveAttorneyBillableQuantity,
} from '@/lib/billing/attorneyBillableQuantity'
import {
  MAX_SELF_SERVE_RESETS,
  buildRebandPreview as buildStickyRebandPreview,
} from '@/lib/billing/firmConnectionStickyFloor'
import type { ConnectionBillingPageState } from '@/lib/billing/firmConnectionBillingSummary'
import {
  formatBandRangeLabel,
  resolveConnectionBillingPageState,
} from '@/lib/billing/firmConnectionBillingSummary'

export type AttorneyConnectionBillingSummary = {
  connectedCount: number
  freeClientsCount: number
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
  billingLine: string
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
  const billableQuantity = resolveAttorneyBillableQuantity(connectedCount, billingFloor)
  const band = bandForCount(billableQuantity, ATTORNEY_BANDS)
  const ratePerClient = rateForCount(billableQuantity, ATTORNEY_BANDS, ATTORNEY_FLOOR)
  const estimatedMonthly = billableQuantity * ratePerClient
  const pageState = resolveConnectionBillingPageState(connectedCount, clientLimit, billingFloor)
  const rangeLabel = formatBandRangeLabel(band)
  const freeClientsCount = Math.min(connectedCount, ATTORNEY_FREE_CLIENTS)

  return {
    connectedCount,
    freeClientsCount,
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
    billingLine:
      billableQuantity > 0
        ? `${connectedCount} clients · ${freeClientsCount} free · billing for ${billableQuantity} · $${estimatedMonthly}/mo`
        : connectedCount > 0
          ? `${connectedCount} client${connectedCount === 1 ? '' : 's'} · 1 free · $0/mo`
          : 'No connected clients yet · 1 free client included',
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
  const billableQuantity = resolveAttorneyBillableQuantity(connectedCount, billingFloor)
  const newBillableCeiling = attorneyBillableBeforeFloor(newLimit)
  const currentBand = bandForCount(billableQuantity, ATTORNEY_BANDS)
  const newBand = bandForCount(newBillableCeiling, ATTORNEY_BANDS)
  const currentRate = rateForCount(billableQuantity, ATTORNEY_BANDS, ATTORNEY_FLOOR)
  const newRate = rateForCount(newBillableCeiling, ATTORNEY_BANDS, ATTORNEY_FLOOR)

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
  const currentBillableLimit = attorneyBillableBeforeFloor(opts.currentLimit)
  const newBillableLimit = attorneyBillableBeforeFloor(opts.newLimit)
  return buildStickyRebandPreview({
    currentLimit: Math.max(1, currentBillableLimit || 1),
    newLimit: Math.max(1, newBillableLimit || 1),
    connectedCount: opts.connectedCount,
    resetCount: opts.resetCount,
    bands: ATTORNEY_BANDS,
    rateFloor: ATTORNEY_FLOOR,
  })
}
