'use client'

import { useMemo, useState, useEffect } from 'react'
import { BILLING_DISCLOSURES } from '@/lib/compliance/billing-disclosures'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { BillingPeriodToggle } from '@/components/billing/BillingPeriodToggle'
import {
  getConsumerPlansForPeriod,
  formatPlanPriceDisplay,
  type ConsumerPlanForCheckout,
} from '@/lib/billing/consumerPlanCatalog'
import type { BillingPeriod, PlanTier } from '@/lib/billing/stripePrices'
import { TIER_PRICES, PRICE_ID_TO_TIER, TIER_NAMES } from '@/lib/tiers'

type Props = {
  currentPlan: string | null
  subscriptionStatus: string | null
  subscriptionPeriodEnd: string | null
  subscribedPeriod?: BillingPeriod | null
  isAdvisorClient: boolean
  annualBillingAvailable: boolean
  recommendedPlanId?: 'financial' | 'retirement' | 'estate' | null
}

export function BillingClient({
  currentPlan,
  subscriptionStatus,
  subscriptionPeriodEnd,
  subscribedPeriod = null,
  isAdvisorClient,
  annualBillingAvailable,
  recommendedPlanId = null,
}: Props) {
  const [period, setPeriod] = useState<BillingPeriod>(() => subscribedPeriod ?? 'monthly')
  const billingPeriod = annualBillingAvailable ? period : 'monthly'
  const [loadingCheckoutTier, setLoadingCheckoutTier] = useState<PlanTier | null>(null)
  const [loadingAction, setLoadingAction] = useState<'portal' | 'cancel' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelMessage, setCancelMessage] = useState<string | null>(null)

  const plans = useMemo(
    () => getConsumerPlansForPeriod(billingPeriod),
    [billingPeriod],
  )

  const subscribedPlans = useMemo(
    () =>
      subscribedPeriod && annualBillingAvailable
        ? getConsumerPlansForPeriod(subscribedPeriod)
        : plans,
    [subscribedPeriod, annualBillingAvailable, plans],
  )

  async function handleSubscribe(plan: ConsumerPlanForCheckout) {
    setError(null)
    setLoadingCheckoutTier(plan.tier)
    try {
      const params = new URLSearchParams(window.location.search)
      const returnTo = params.get('returnTo') ?? undefined
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: plan.tier,
          period: plan.period,
          ...(returnTo ? { returnTo } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        setLoadingCheckoutTier(null)
        return
      }
      window.location.assign(data.url)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoadingCheckoutTier(null)
    }
  }

  async function handleManageSubscription() {
    setError(null)
    setLoadingAction('portal')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        setLoadingAction(null)
        return
      }
      window.location.assign(data.url)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoadingAction(null)
    }
  }

  async function handleCancelSubscription() {
    setError(null)
    setCancelMessage(null)
    setLoadingAction('cancel')
    try {
      const res = await fetch('/api/stripe/cancel', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        setLoadingAction(null)
        return
      }
      const accessThrough = data.accessThrough
        ? new Date(data.accessThrough).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : subscriptionPeriodEnd
          ? new Date(subscriptionPeriodEnd).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })
          : 'the end of your current billing period'
      setCancelMessage(BILLING_DISCLOSURES.cancellationConfirm(accessThrough))
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoadingAction(null)
    }
  }

  function formatRenewalDate(iso: string | null) {
    if (!iso) return null
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const isActive =
    subscriptionStatus === 'active' ||
    subscriptionStatus === 'trialing' ||
    subscriptionStatus === 'canceling'
  const currentTier =
    currentPlan != null ? (PRICE_ID_TO_TIER[currentPlan] ?? null) : null
  const activePlan =
    currentTier != null ? subscribedPlans.find((p) => p.tier === currentTier) : undefined
  const activePlanName =
    activePlan?.name ??
    (currentTier != null ? TIER_NAMES[currentTier as 1 | 2 | 3] : null)
  const activeRenewalDate = formatRenewalDate(subscriptionPeriodEnd)
  const recommendedPlan = recommendedPlanId
    ? plans.find((p) => p.id === recommendedPlanId) ?? null
    : null

  useEffect(() => {
    if (subscribedPeriod && annualBillingAvailable) {
      setPeriod(subscribedPeriod)
    }
  }, [subscribedPeriod, annualBillingAvailable])

  useEffect(() => {
    if (!recommendedPlanId) return
    const el = document.getElementById(`plan-card-${recommendedPlanId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [recommendedPlanId])

  if (isAdvisorClient) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <Card className="p-8">
          <div className="mb-4 text-4xl">🎉</div>
          <h1 className="text-2xl font-bold text-neutral-900">You&apos;re all set</h1>
          <p className="mt-3 text-neutral-600">
            Your plan is managed by your advisor. There&apos;s nothing to do here.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Choose your plan</h1>
        <p className="mt-3 text-neutral-600">
          Professional planning infrastructure at a fraction of attorney fees.
        </p>
        <p className="mt-1 text-sm text-[color:var(--mwm-text-muted)]">
          {`Starting at $${TIER_PRICES[1]}/month · Estate plan includes a 14-day free trial`}
        </p>
        {isActive && activePlanName && (
          <p className="mt-2 text-sm font-medium text-green-600">
            You are currently on the {activePlanName} plan
          </p>
        )}
      </div>

      <BillingPeriodToggle
        period={period}
        onChange={setPeriod}
        annualAvailable={annualBillingAvailable}
      />

      {recommendedPlan && !isActive && (
        <div className="mb-6 rounded-lg border border-[color:var(--mwm-gold)]/40 bg-[color:var(--mwm-gold)]/10 px-4 py-3 text-center text-sm text-[color:var(--mwm-navy)]">
          Based on your assessment, we recommend the{' '}
          <strong>{recommendedPlan.name}</strong> plan
          {recommendedPlan.trialDays > 0 ? ' — includes a 14-day free trial' : ''}.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          {error}
        </div>
      )}

      {cancelMessage && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-center text-sm text-green-800">
          {cancelMessage}
        </div>
      )}

      {isActive && activePlan && activeRenewalDate && (
        <div className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-center text-sm text-neutral-800">
          {BILLING_DISCLOSURES.activeSubscription(
            activePlanName ?? activePlan.name,
            `$${activePlan.displayPrice}`,
            activeRenewalDate,
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const { main, sub } = formatPlanPriceDisplay(plan)
          const isCurrentPlan =
            currentTier !== null && plan.tier === currentTier
          const showCheckout = !(isCurrentPlan && isActive)
          const highlighted = plan.highlighted

          const isRecommended = recommendedPlanId === plan.id

          return (
            <div key={`${plan.tier}-${period}`} id={`plan-card-${plan.id}`}>
            <Card
              hover={!highlighted}
              className={`relative rounded-2xl p-8 shadow-md ring-1 ${
                highlighted
                  ? '!border-[var(--mwm-navy)] !bg-[var(--mwm-navy)] ring-[color:var(--mwm-navy)]'
                  : 'ring-neutral-200'
              } ${isRecommended ? 'ring-2 ring-[color:var(--mwm-gold)] ring-offset-2' : ''}`}
            >
              {plan.badge && (
                <span
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                    highlighted
                      ? 'bg-[var(--mwm-gold)] text-[color:var(--mwm-navy)]'
                      : 'bg-[var(--mwm-navy)] text-white'
                  }`}
                >
                  {plan.badge}
                </span>
              )}
              {isCurrentPlan && isActive && (
                <span className="absolute -top-3 right-4 rounded-full bg-green-500 px-3 py-1 text-xs font-medium text-white">
                  Current Plan
                </span>
              )}
              <h2
                className={`text-lg font-semibold ${highlighted ? 'text-white' : 'text-neutral-900'}`}
              >
                {plan.name}
              </h2>
              <p
                className={`mt-1 text-sm ${highlighted ? 'text-neutral-200' : 'text-neutral-500'}`}
              >
                {plan.description}
              </p>
              <div className="mt-4 flex flex-wrap items-baseline gap-1">
                <span
                  className={`text-4xl font-bold ${highlighted ? 'text-white' : 'text-neutral-900'}`}
                >
                  {main}
                </span>
                {sub && (
                  <span
                    className={`text-sm ${highlighted ? 'text-neutral-300' : 'text-neutral-500'}`}
                  >
                    {sub}
                  </span>
                )}
              </div>
              {period === 'annual' && plan.annualTotal && (
                <p
                  className={`mt-1 text-xs ${highlighted ? 'text-neutral-300' : 'text-neutral-500'}`}
                >
                  Billed ${plan.annualTotal.toLocaleString()} annually
                </p>
              )}
              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <span
                      className={`text-lg leading-none ${highlighted ? 'text-[color:var(--mwm-gold-light)]' : 'text-[color:var(--mwm-navy)]'}`}
                    >
                      ✓
                    </span>
                    <span className={highlighted ? 'text-neutral-100' : 'text-neutral-600'}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
              {showCheckout && (
                <p
                  className={`mt-6 text-sm leading-relaxed ${
                    highlighted ? 'text-neutral-200' : 'text-neutral-700'
                  }`}
                >
                  {BILLING_DISCLOSURES.preCheckout(
                    plan.name,
                    plan.period === 'annual' && plan.annualTotal
                      ? `$${plan.annualTotal}`
                      : plan.priceLabel,
                    plan.intervalLabel,
                  )}
                </p>
              )}
              <Button
                type="button"
                onClick={() => void handleSubscribe(plan)}
                disabled={loadingCheckoutTier === plan.tier || (isCurrentPlan && isActive)}
                variant="primary"
                className="mt-4 w-full rounded-lg py-2.5 text-sm font-medium"
              >
                {isCurrentPlan && isActive
                  ? 'Current Plan'
                  : loadingCheckoutTier === plan.tier
                    ? 'Redirecting...'
                    : plan.cta}
              </Button>
            </Card>
            </div>
          )
        })}
      </div>

      {plans.some((p) => p.tier === 3) && (
        <p className="mx-auto mt-6 max-w-md text-center text-xs text-[color:var(--mwm-text-muted)]">
          A single estate planning attorney consultation often costs $3,000–$5,000. My Wealth Maps
          prepares you to make every minute count.
        </p>
      )}

      <p className="mt-6 text-center text-xs text-[color:var(--mwm-text-muted)]">
        {BILLING_DISCLOSURES.pricingPageNotice}
      </p>

      <div className="mt-8 flex flex-col items-center gap-3 text-center">
        {isActive && subscriptionStatus !== 'canceling' && (
          <button
            type="button"
            onClick={() => void handleCancelSubscription()}
            disabled={loadingAction === 'cancel'}
            className="text-sm font-medium text-neutral-800 underline-offset-4 hover:text-neutral-950 hover:underline disabled:opacity-50"
          >
            {loadingAction === 'cancel' ? 'Cancelling…' : 'Cancel subscription'}
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleManageSubscription()}
          disabled={loadingAction === 'portal'}
          className="text-sm text-neutral-500 underline-offset-4 hover:text-neutral-700 hover:underline disabled:opacity-50"
        >
          {loadingAction === 'portal' ? 'Loading...' : 'Manage existing subscription'}
        </button>
      </div>
    </div>
  )
}
