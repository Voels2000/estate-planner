import { TIER_FEATURES } from '@/lib/tiers'
import { getPriceConfig, type BillingPeriod, type PlanTier } from '@/lib/billing/stripePrices'

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
    name: 'Financial',
    description: 'Get organized and see your full financial picture.',
    features: TIER_FEATURES[1],
    highlighted: false,
    badge: null,
    accent: '#0f1f3d',
    cta: 'Get started',
  },
  {
    tier: 2,
    id: 'retirement',
    name: 'Retirement',
    description: 'Explore retirement projections with advanced planning tools.',
    features: TIER_FEATURES[2],
    highlighted: false,
    badge: null,
    accent: '#c9a84c',
    cta: 'Start Retirement plan',
  },
  {
    tier: 3,
    id: 'estate',
    name: 'Estate',
    description: 'Complete estate and advanced tax planning.',
    features: [
      ...TIER_FEATURES[3],
      'Estate execution checklist',
    ],
    highlighted: true,
    badge: '14-day free trial',
    accent: '#4a7c6f',
    cta: 'Start free trial',
  },
]

export type ConsumerPlanForCheckout = ConsumerPlanCatalogEntry & {
  priceId: string
  displayPrice: number
  annualTotal: number | null
  period: BillingPeriod
  trialDays: number
  priceLabel: string
  intervalLabel: 'month' | 'year'
}

export function getConsumerPlansForPeriod(period: BillingPeriod): ConsumerPlanForCheckout[] {
  return CONSUMER_PLAN_CATALOG.map((plan) => {
    const price = getPriceConfig(plan.tier, period)
    const displayPrice = price.monthlyEquivalent
    const annualTotal = period === 'annual' ? price.annualTotal : null
    return {
      ...plan,
      priceId: price.priceId,
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
