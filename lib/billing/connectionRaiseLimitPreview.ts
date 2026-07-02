import type { ConnectionBand } from '@/lib/pricing/connectionPricing'
import { bandForCount, rateForCount } from '@/lib/pricing/connectionPricing'

export type ConnectionRaiseLimitPreview = {
  newLimit: number
  currentBandLabel: string
  newBandLabel: string
  currentRatePerClient: number
  newRatePerClient: number
  currentMonthly: number
  newMonthly: number
  rateImproved: boolean
  billableQuantity: number
  /** Billable qty after connecting one more household at the new ceiling. */
  nextBillableOnConnect: number
  nextClientMonthlyCost: number
}

/** Shared raise preview — billable unchanged until new clients connect. */
export function buildConnectionRaiseLimitPreview(opts: {
  connectedCount: number
  billingFloor: number | null | undefined
  newLimit: number
  bands: ConnectionBand[]
  rateFloor: number
  billableQuantity: (connected: number, floor: number) => number
  bandCountForNewLimit: (newLimit: number) => number
  billableAfterOneMoreConnect: (connected: number) => number
}): ConnectionRaiseLimitPreview {
  const connectedCount = Math.max(0, Math.floor(opts.connectedCount))
  const billingFloor = Math.max(0, Math.floor(opts.billingFloor ?? 0))
  const newLimit = Math.max(1, Math.floor(opts.newLimit))
  const billableQuantity = opts.billableQuantity(connectedCount, billingFloor)
  const newBandCount = opts.bandCountForNewLimit(newLimit)
  const currentBand = bandForCount(billableQuantity, opts.bands)
  const newBand = bandForCount(newBandCount, opts.bands)
  const currentRate = rateForCount(billableQuantity, opts.bands, opts.rateFloor)
  const newRate = rateForCount(newBandCount, opts.bands, opts.rateFloor)
  const nextBillableOnConnect = opts.billableAfterOneMoreConnect(connectedCount)
  const nextClientRate = rateForCount(nextBillableOnConnect, opts.bands, opts.rateFloor)

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
    nextBillableOnConnect,
    nextClientMonthlyCost: nextBillableOnConnect * nextClientRate,
  }
}
