import { TIER_DESCRIPTIONS, TIER_FEATURES, TIER_NAMES } from '@/lib/tiers'
import { getConsumerPlanDisplay, type BillingPeriod, type PlanTier } from '@/lib/billing/stripePrices'

const ESTATE_TRIAL_DAYS = getConsumerPlanDisplay(3, 'monthly').trialDays
const ESTATE_TRIAL_BADGE =
  ESTATE_TRIAL_DAYS > 0 ? `${ESTATE_TRIAL_DAYS}-day free trial` : null

export type ConsumerPlanCatalogEntry = {
  tier: PlanTier
  id: 'financial' | 'retirement' | 'estate'
  name: string
  description: string
  features: readonly string[]
  highlighted: boolean
  badge: string | null
  accent: string
  cta: string
}

export const CONSUMER_PLAN_CATALOG: ConsumerPlanCatalogEntry[] = [
  {
    tier: 1,
    id: 'financial',
    name: TIER_NAMES[1],
    description: `${TIER_DESCRIPTIONS[1]}.`,
    features: TIER_FEATURES[1],
    highlighted: false,
    badge: null,
    accent: '#0f1f3d',
    cta: 'Get started',
  },
  {
    tier: 2,
    id: 'retirement',
    name: TIER_NAMES[2],
    description: `${TIER_DESCRIPTIONS[2]}.`,
    features: TIER_FEATURES[2],
    highlighted: false,
    badge: null,
    accent: '#c9a84c',
    cta: 'Start Retirement plan',
  },
  {
    tier: 3,
    id: 'estate',
    name: TIER_NAMES[3],
    description: `${TIER_DESCRIPTIONS[3]}.`,
    features: [
      ...TIER_FEATURES[3],
      'Estate execution checklist',
    ],
    highlighted: true,
    badge: ESTATE_TRIAL_BADGE,
    accent: '#4a7c6f',
    cta: 'Subscribe',
  },
]

export type ConsumerPlanForCheckout = ConsumerPlanCatalogEntry & {
  displayPrice: number
  annualTotal: number | null
  period: BillingPeriod
  trialDays: number
  priceLabel: string
  intervalLabel: 'month' | 'year'
}

export function getConsumerPlansForPeriod(period: BillingPeriod): ConsumerPlanForCheckout[] {
  return CONSUMER_PLAN_CATALOG.map((plan) => {
    const price = getConsumerPlanDisplay(plan.tier, period)
    const displayPrice = price.monthlyEquivalent
    const annualTotal = period === 'annual' ? price.annualTotal : null
    return {
      ...plan,
      displayPrice,
      annualTotal,
      period,
      trialDays: price.trialDays,
      priceLabel: `$${displayPrice}`,
      intervalLabel: period === 'annual' ? 'year' : 'month',
    }
  })
}

export function formatPlanPriceDisplay(
  plan: ConsumerPlanForCheckout,
): { main: string; sub?: string } {
  if (plan.period === 'annual' && plan.annualTotal) {
    return {
      main: `$${plan.displayPrice}`,
      sub: `/month · $${plan.annualTotal.toLocaleString()}/year`,
    }
  }
  return { main: `$${plan.displayPrice}`, sub: '/month' }
}
