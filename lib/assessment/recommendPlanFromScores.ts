import { getConsumerPlanDisplay } from '@/lib/billing/stripePrices'

const ESTATE_TRIAL_DAYS = getConsumerPlanDisplay(3, 'monthly').trialDays

export type RecommendedPlanId = 'financial' | 'retirement' | 'estate'

export type PlanRecommendation = {
  planId: RecommendedPlanId
  tier: 1 | 2 | 3
  planName: string
  reason: string
  ctaLabel: string
}

const PLAN_META: Record<
  RecommendedPlanId,
  { tier: 1 | 2 | 3; planName: string; label: string }
> = {
  financial: { tier: 1, planName: 'Financial', label: 'financial planning' },
  retirement: { tier: 2, planName: 'Retirement', label: 'retirement planning' },
  estate: { tier: 3, planName: 'Estate', label: 'estate planning' },
}

/** Recommend a subscription tier from assessment pillar scores (0–100). */
export function recommendPlanFromScores(
  financialPct: number,
  retirementPct: number,
  estatePct: number,
): PlanRecommendation {
  const pillars = [
    { planId: 'financial' as const, pct: financialPct },
    { planId: 'retirement' as const, pct: retirementPct },
    { planId: 'estate' as const, pct: estatePct },
  ]

  const weakest = pillars.reduce((min, pillar) => (pillar.pct < min.pct ? pillar : min), pillars[0])
  const meta = PLAN_META[weakest.planId]

  return {
    planId: weakest.planId,
    tier: meta.tier,
    planName: meta.planName,
    reason: `Your ${meta.label} score (${weakest.pct}%) has the most room to improve — the ${meta.planName} plan includes the tools to address those gaps.`,
    ctaLabel:
      weakest.planId === 'estate'
        ? ESTATE_TRIAL_DAYS > 0
          ? `Start ${ESTATE_TRIAL_DAYS}-day Estate trial`
          : 'Subscribe to Estate'
        : `Get started with ${meta.planName}`,
  }
}

export function billingHrefForPlan(
  planId: RecommendedPlanId,
  returnTo = '/assess',
): string {
  const params = new URLSearchParams({ plan: planId, returnTo })
  return `/billing?${params.toString()}`
}
