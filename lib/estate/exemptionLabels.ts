/** Shared consumer UI labels — keep gifting vs estate-tax semantics distinct. */

/** Form 709 / annual overflow consumed from unified credit (same as RPC lifetime_exemption_used). */
export const LIFETIME_GIFTS_USED_LABEL = 'Lifetime gifts used'

/** Unified credit available for estate tax after lifetime gifts (composition exemption_available). */
export const FEDERAL_EXEMPTION_AFTER_GIFTS_LABEL = 'Federal exemption (after gifts)'

/** Room before federal estate tax (consumer-facing; aligns with My Estate Strategy horizons). */
export const HEADROOM_BEFORE_FEDERAL_TAX_LABEL = 'Headroom before federal tax'

/**
 * Headroom shown on dashboard / horizons — exemption after gifts minus inside estate.
 * Differs from RPC `exemption_remaining` (exemption minus taxable estate after admin/strategy adjustments).
 */
export function computeHeadroomBeforeFederalTax(
  exemptionAvailable: number,
  grossEstate: number,
  outsideStrategyTotal = 0,
): number {
  const insideTotal = Math.max(0, grossEstate - outsideStrategyTotal)
  return Math.max(0, exemptionAvailable - insideTotal)
}

/** Gifting tab only — statutory credit minus lifetime gifts used, before current estate is applied. */
export const LIFETIME_EXEMPTION_REMAINING_LABEL = 'Lifetime exemption remaining'
