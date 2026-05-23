import { computeBusinessOwnershipValue } from '@/lib/my-estate-strategy/horizonSnapshots'

export const BUSINESS_VALUE_THRESHOLD_5M = 5_000_000
export const BUSINESS_VALUE_THRESHOLD_10M = 10_000_000

export type BusinessThresholdAlert = '5m' | '10m' | null

export type PersonaDashboardAlerts = {
  businessThreshold: BusinessThresholdAlert
  businessOwnershipValue: number
  multiStateRealEstate: boolean
  distinctPropertyStates: string[]
}

export function buildPersonaDashboardAlerts(input: {
  businesses: { estimated_value?: unknown; ownership_pct?: unknown }[]
  businessInterests: {
    fmv_estimated?: unknown
    total_entity_value?: unknown
    ownership_pct?: unknown
  }[]
  realEstate: { situs_state?: string | null }[]
}): PersonaDashboardAlerts {
  const businessOwnershipValue = computeBusinessOwnershipValue(
    input.businesses ?? [],
    input.businessInterests ?? [],
  )

  let businessThreshold: BusinessThresholdAlert = null
  if (businessOwnershipValue >= BUSINESS_VALUE_THRESHOLD_10M) {
    businessThreshold = '10m'
  } else if (businessOwnershipValue >= BUSINESS_VALUE_THRESHOLD_5M) {
    businessThreshold = '5m'
  }

  const distinctPropertyStates = [
    ...new Set(
      (input.realEstate ?? [])
        .map((r) => (r.situs_state ?? '').trim().toUpperCase())
        .filter((s) => s.length >= 2),
    ),
  ].sort()

  return {
    businessThreshold,
    businessOwnershipValue,
    multiStateRealEstate: distinctPropertyStates.length >= 2,
    distinctPropertyStates,
  }
}
