import { ADVISOR_FIRM_PRICE_IDS } from '@/lib/tiers'

/** Firm starter price on the deployment under test (set in .env.test when IDs differ from code fallbacks). */
export function firmStarterPriceIdForE2e(): string {
  return (
    process.env.PLAYWRIGHT_ADVISOR_FIRM_STARTER_PRICE_ID?.trim() ||
    ADVISOR_FIRM_PRICE_IDS.starter
  )
}

/** Enterprise price on the deployment under test — required for firm-checkout rejection smoke. */
export function firmEnterprisePriceIdForE2e(): string {
  return (
    process.env.PLAYWRIGHT_ADVISOR_FIRM_ENTERPRISE_PRICE_ID?.trim() ||
    process.env.STRIPE_PRICE_ADVISOR_ENTERPRISE_MONTHLY?.trim() ||
    ADVISOR_FIRM_PRICE_IDS.enterprise
  )
}
