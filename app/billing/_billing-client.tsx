'use client'

import { useMemo, useState, useEffect } from 'react'
import { BILLING_DISCLOSURES } from '@/lib/compliance/billing-disclosures'
import { Button } from '@/components/ui/Button'
import { BillingPeriodToggle } from '@/components/billing/BillingPeriodToggle'
import { BillingCapabilityMatrix } from '@/components/billing/BillingCapabilityMatrix'
import { BillingPageTrialBanner } from '@/components/billing/BillingPageTrialBanner'
import { BillingPlanAndExportSection } from '@/components/billing/BillingPlanAndExportSection'
import {
  getConsumerPlansForPeriod,
  type ConsumerPlanForCheckout,
} from '@/lib/billing/consumerPlanCatalog'
import type { BillingPeriod, PlanTier } from '@/lib/billing/stripePrices'
import { getBillingTierColumns } from '@/lib/billing/billingTierPresentation'
import {
  resolveBillingTrialBanner,
  type BillingTrialBannerState,
} from '@/lib/billing/resolveBillingTrialBanner'
import { PRICE_ID_TO_TIER, TIER_NAMES } from '@/lib/tiers'
import type { BillingMatrixTier } from '@/lib/billing/billingCapabilityMatrix'

type Props = {
  currentPlan: string | null
  subscriptionStatus: string | null
  subscriptionPeriodEnd: string | null
  subscribedPeriod?: BillingPeriod | null
  isAdvisorClient: boolean
  annualBillingAvailable: boolean
  recommendedPlanId?: 'financial' | 'retirement' | 'estate' | null
  showPlanAndExportOffer?: boolean
  trialEndsAt?: string | null
  hasEverSubscribed?: boolean
}

export function BillingClient({
  currentPlan,
  subscriptionStatus,
  subscriptionPeriodEnd,
  subscribedPeriod = null,
  isAdvisorClient,
  annualBillingAvailable,
  recommendedPlanId = null,
  showPlanAndExportOffer = false,
  trialEndsAt = null,
  hasEverSubscribed = false,
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

  const tierColumns = useMemo(
    () => getBillingTierColumns(billingPeriod),
    [billingPeriod],
  )

  const trialBanner: BillingTrialBannerState | null = useMemo(
    () =>
      resolveBillingTrialBanner({
        trialEndsAt,
        hasEverSubscribed,
        subscriptionStatus,
        subscriptionPeriodEnd,
      }),
    [trialEndsAt, hasEverSubscribed, subscriptionStatus, subscriptionPeriodEnd],
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

  const recommendedTier: BillingMatrixTier =
    recommendedPlanId === 'financial'
      ? 1
      : recommendedPlanId === 'retirement'
        ? 2
        : recommendedPlanId === 'estate'
          ? 3
          : currentTier ?? 3

  const mobileFocusTier: BillingMatrixTier = isActive && currentTier ? currentTier : recommendedTier

  useEffect(() => {
    if (subscribedPeriod && annualBillingAvailable) {
      setPeriod(subscribedPeriod)
    }
  }, [subscribedPeriod, annualBillingAvailable])

  if (isAdvisorClient) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div className="mb-4 text-4xl">🎉</div>
          <h1 className="text-2xl font-bold text-neutral-900">You&apos;re all set</h1>
          <p className="mt-3 text-neutral-600">
            Your plan is managed by your advisor. There&apos;s nothing to do here.
          </p>
        </div>
      </div>
    )
  }

  const paidPlans = plans.filter((p) => p.tier >= 1 && p.tier <= 3)

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-[color:var(--mwm-navy)]">
          Choose your plan
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-[color:var(--mwm-text-secondary)]">
          Professional planning infrastructure at a fraction of attorney fees.
        </p>
        {isActive && activePlanName && (
          <p className="mt-2 text-sm font-medium text-green-700">
            You are currently on the {activePlanName} plan
          </p>
        )}
      </div>

      {trialBanner && <BillingPageTrialBanner state={trialBanner} />}

      <BillingPeriodToggle
        period={period}
        onChange={setPeriod}
        annualAvailable={annualBillingAvailable}
      />

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

      <BillingCapabilityMatrix columns={tierColumns} mobileFocusTier={mobileFocusTier} />

      {/* Tier one-liners (desktop) */}
      <div className="mt-8 hidden gap-4 lg:grid lg:grid-cols-4">
        {tierColumns.map((col) => (
          <p
            key={col.tier}
            className={`text-xs leading-relaxed text-[color:var(--mwm-text-muted)] ${
              col.highlighted ? 'rounded-lg bg-[color:var(--mwm-navy)]/5 p-3' : ''
            }`}
          >
            {col.oneLiner}
          </p>
        ))}
      </div>

      {/* Subscribe actions — paid tiers only */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {paidPlans.map((plan) => {
          const isCurrentPlan = currentTier !== null && plan.tier === currentTier
          const showCheckout = !(isCurrentPlan && isActive)
          const col = tierColumns.find((c) => c.checkoutTier === plan.tier)

          return (
            <div
              key={`${plan.tier}-${period}`}
              id={`plan-card-${plan.id}`}
              className={`rounded-xl border p-5 ${
                col?.highlighted
                  ? 'border-[color:var(--mwm-navy)]/25 bg-[color:var(--mwm-navy)]/5'
                  : 'border-[color:var(--mwm-border)] bg-white'
              }`}
            >
              <p className="text-sm font-semibold text-[color:var(--mwm-navy)]">{plan.name}</p>
              {showCheckout && (
                <p className="mt-2 text-xs leading-relaxed text-[color:var(--mwm-text-muted)]">
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
                  ? 'Current plan'
                  : loadingCheckoutTier === plan.tier
                    ? 'Redirecting…'
                    : plan.cta}
              </Button>
            </div>
          )
        })}
      </div>

      {showPlanAndExportOffer && <BillingPlanAndExportSection returnTo="/print" />}

      <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-[color:var(--mwm-text-muted)]">
        A single estate planning attorney consultation often costs $3,000–$5,000. My Wealth Maps
        prepares you to make every minute count.
      </p>

      <p className="mt-4 text-center text-xs text-[color:var(--mwm-text-muted)]">
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
