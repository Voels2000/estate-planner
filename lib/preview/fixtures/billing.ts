import type { ComponentProps } from 'react'
import { BillingClient } from '@/app/billing/_billing-client'
import { FirmBillingClient } from '@/app/billing/_firm-billing-client'
import { AttorneyBillingClient } from '@/app/(attorney)/attorney/billing/_attorney-billing-client'
import { ATTORNEY_PLAN_LIMITS } from '@/lib/tiers'
import { getPriceConfig } from '@/lib/billing/stripePrices'

/** Preview-only — matches stripePrices legacy fallbacks when env is unset. */
const ESTATE_PRICE_ID = getPriceConfig(3, 'monthly').priceId
const FINANCIAL_PRICE_ID = getPriceConfig(1, 'monthly').priceId

const billingClientBase: ComponentProps<typeof BillingClient> = {
  currentPlan: null,
  subscriptionStatus: null,
  subscriptionPeriodEnd: null,
  subscribedPeriod: null,
  isAdvisorClient: false,
  annualBillingAvailable: true,
  recommendedPlanId: null,
}

/** Consumer — Estate tier picker (highlighted navy/gold card). */
export const fxConsumerEstate: ComponentProps<typeof BillingClient> = {
  ...billingClientBase,
  recommendedPlanId: 'estate',
}

/** Consumer — Financial tier 1, no active subscription. */
export const fxConsumerTier1: ComponentProps<typeof BillingClient> = {
  ...billingClientBase,
  subscriptionStatus: 'none',
  annualBillingAvailable: true,
}

/** Consumer — active Estate subscription. */
export const fxConsumerEstateActive: ComponentProps<typeof BillingClient> = {
  ...billingClientBase,
  currentPlan: ESTATE_PRICE_ID,
  subscriptionStatus: 'active',
  subscriptionPeriodEnd: '2027-06-19T00:00:00.000Z',
  subscribedPeriod: 'monthly',
}

/** Consumer — linked advisor client (`BillingClient` early return). */
export const fxAdvisorLinkedClient: ComponentProps<typeof BillingClient> = {
  ...billingClientBase,
  currentPlan: FINANCIAL_PRICE_ID,
  subscriptionStatus: 'active',
  isAdvisorClient: true,
}

/** Advisor firm owner — active firm subscription. */
export const fxAdvisorOwnerActive: ComponentProps<typeof FirmBillingClient> = {
  firmName: 'Preview Advisory LLC',
  firmTierKey: 'starter',
  perSeatRate: 149,
  seatCount: 4,
  totalMonthly: 596,
  subscriptionStatus: 'active',
  firmCheckoutPriceId: 'price_preview_firm_starter',
}

/** Advisor firm owner — pre-subscribe (seat picker + Subscribe Now). */
export const fxAdvisorOwnerSubscribe: ComponentProps<typeof FirmBillingClient> = {
  firmName: 'Preview Advisory LLC',
  firmTierKey: 'starter',
  perSeatRate: 149,
  seatCount: 0,
  totalMonthly: 0,
  subscriptionStatus: null,
  firmCheckoutPriceId: 'price_preview_firm_starter',
}

/** Attorney portal billing — mirrors `/attorney/billing` plan list. */
export const fxAttorneyPlans: ComponentProps<typeof AttorneyBillingClient> = {
  currentTier: 0,
  checkoutSuccess: false,
  canceled: false,
  plans: [
    {
      id: 0,
      name: 'Free',
      price: '$0',
      features: [
        'Read-only client access (up to 3 clients visible)',
        'Document vault upload/download',
        'Basic client list',
      ],
    },
    {
      id: 1,
      planKey: 'starter',
      name: 'Attorney Starter',
      price: `$${ATTORNEY_PLAN_LIMITS.starter.priceMonthly}/mo`,
      features: [
        'Up to 15 client households',
        'Document vault + gap alerts',
        'Intake summary PDF export',
        'Multi-client document health dashboard',
      ],
    },
    {
      id: 2,
      planKey: 'growth',
      name: 'Attorney Growth',
      price: `$${ATTORNEY_PLAN_LIMITS.growth.priceMonthly}/mo`,
      features: [
        'Up to 50 client households',
        'PDF branding on intake exports',
        'Bulk client management',
        'Everything in Starter',
      ],
    },
  ],
}
