/** IRS annual gift exclusion per recipient (2026). Update when tax law changes. */
export const ANNUAL_EXCLUSION_INDIVIDUAL = 19_000
export const ANNUAL_EXCLUSION_GIFT_SPLIT = 38_000

/** Household annual gifting capacity — two donors when MFJ. */
export const ANNUAL_EXCLUSION_MFJ_CAPACITY = 36_000
export const ANNUAL_EXCLUSION_SINGLE_CAPACITY = 18_000

/** Prefer RPC `per_recipient_limit`; fall back to split vs individual defaults. */
export function perRecipientLimitFromSplit(
  splitSelected: boolean,
  rpcLimit?: number | null,
): number {
  if (rpcLimit != null && rpcLimit > 0) return rpcLimit
  return splitSelected ? ANNUAL_EXCLUSION_GIFT_SPLIT : ANNUAL_EXCLUSION_INDIVIDUAL
}

export function annualGiftingCapacity(isMfj: boolean): number {
  return isMfj ? ANNUAL_EXCLUSION_MFJ_CAPACITY : ANNUAL_EXCLUSION_SINGLE_CAPACITY
}
