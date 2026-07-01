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
  resolveStickyBillableQuantity,
} from '@/lib/billing/firmConnectionStickyFloor'
import type { ConnectionBillingPageState } from '@/lib/billing/firmConnectionBillingSummary'
import {
  formatBandRangeLabel,
  resolveConnectionBillingPageState,
} from '@/lib/billing/firmConnectionBillingSummary'
import { buildConnectionRaiseLimitPreview } from '@/lib/billing/connectionRaiseLimitPreview'

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
  atCapacityRaiseHint: string | null
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
  const atCapacity = pageState === 'at_capacity'
  const nextClientRate = rateForCount(
    attorneyBillableBeforeFloor(connectedCount + 1),
    ATTORNEY_BANDS,
    ATTORNEY_FLOOR,
  )

  const connectedCapacityLine = atCapacity
    ? `You've connected ${connectedCount} of ${clientLimit} clients (${freeClientsCount} free)`
    : `${connectedCount} of ${clientLimit} client capacity`

  const billingLine =
    billableQuantity > 0
      ? atCapacity
        ? `Billing for ${billableQuantity} at $${estimatedMonthly}/mo`
        : `${connectedCount} clients · ${freeClientsCount} free · billing for ${billableQuantity} · $${estimatedMonthly}/mo`
      : connectedCount > 0
        ? `${connectedCount} client${connectedCount === 1 ? '' : 's'} · 1 free · $0/mo`
        : 'No connected clients yet · 1 free client included'

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
    connectedCapacityLine,
    billingLine,
    atCapacityRaiseHint: atCapacity
      ? `Raise your limit to connect more — each additional billable client is $${nextClientRate}/mo.`
      : null,
    canLowerLimit: connectedCount < clientLimit && resetCount < MAX_SELF_SERVE_RESETS,
    canRaiseLimit: true,
  }
}

export function buildAttorneyRaiseLimitPreview(opts: {
  connectedCount: number
  billingFloor: number | null | undefined
  newLimit: number
}) {
  return buildConnectionRaiseLimitPreview({
    connectedCount: opts.connectedCount,
    billingFloor: opts.billingFloor,
    newLimit: opts.newLimit,
    bands: ATTORNEY_BANDS,
    rateFloor: ATTORNEY_FLOOR,
    billableQuantity: resolveAttorneyBillableQuantity,
    bandCountForNewLimit: attorneyBillableBeforeFloor,
    billableAfterOneMoreConnect: (connected) => attorneyBillableBeforeFloor(connected + 1),
  })
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
