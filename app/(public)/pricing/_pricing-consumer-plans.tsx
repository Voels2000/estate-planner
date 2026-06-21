'use client'

import { useMemo, useState } from 'react'
import { BILLING_DISCLOSURES } from '@/lib/compliance/billing-disclosures'
import { BillingPeriodToggle } from '@/components/billing/BillingPeriodToggle'
import {
  formatPlanPriceDisplay,
  getConsumerPlansForPeriod,
  type ConsumerPlanForCheckout,
} from '@/lib/billing/consumerPlanCatalog'
import { getConsumerPlanDisplay, type BillingPeriod, type PlanTier } from '@/lib/billing/stripePrices'

function estateAnnualSavingsLine(annualBillingAvailable: boolean): string | null {
  if (!annualBillingAvailable) return null
  const annual = getConsumerPlanDisplay(3, 'annual')
  const monthly = getConsumerPlanDisplay(3, 'monthly')
  const savings = monthly.monthlyEquivalent * 12 - annual.annualTotal
  return `Or $${annual.annualTotal.toLocaleString()}/year (save $${savings.toLocaleString()} vs monthly)`
}

type Props = {
  isLoggedIn: boolean
  signupHref: string
  annualBillingAvailable: boolean
}

export function PricingConsumerPlans({
  isLoggedIn,
  signupHref,
  annualBillingAvailable,
}: Props) {
  const [period, setPeriod] = useState<BillingPeriod>('monthly')
  const [loadingCheckoutTier, setLoadingCheckoutTier] = useState<PlanTier | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const billingPeriod = annualBillingAvailable ? period : 'monthly'
  const plans = useMemo(
    () => getConsumerPlansForPeriod(billingPeriod),
    [billingPeriod],
  )

  async function handleCheckout(plan: ConsumerPlanForCheckout) {
    setCheckoutError(null)
    setLoadingCheckoutTier(plan.tier)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: plan.tier, period: plan.period }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.assign(data.url)
        return
      }
      setCheckoutError(
        typeof data.error === 'string'
          ? data.error
          : 'Checkout failed. Please try again or visit Billing after signing in.',
      )
    } catch {
      setCheckoutError('Network error. Please try again.')
    } finally {
      setLoadingCheckoutTier(null)
    }
  }

  return (
    <>
      <BillingPeriodToggle
        period={period}
        onChange={setPeriod}
        annualAvailable={annualBillingAvailable}
      />

      {checkoutError && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#b91c1c',
            fontSize: 14,
            textAlign: 'center',
          }}
        >
          {checkoutError}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
        }}
      >
        {plans.map((plan) => {
          const { main, sub } = formatPlanPriceDisplay(plan)
          const isEstate = plan.tier === 3
          const highlighted = isEstate

          return (
            <div
              key={`${plan.id}-${period}`}
              style={{
                background: 'white',
                border: highlighted ? `2px solid ${plan.accent}` : '1px solid #e2e8f0',
                borderRadius: 16,
                padding: '32px 28px',
                position: 'relative',
                boxShadow: highlighted
                  ? '0 8px 40px rgba(15,31,61,0.12)'
                  : '0 4px 20px rgba(15,31,61,0.08)',
                overflow: 'visible',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  background: plan.accent,
                  borderRadius: '16px 16px 0 0',
                }}
              />

              {plan.badge && (
                <div
                  style={{
                    position: 'absolute',
                    top: -14,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: plan.accent,
                    color: plan.accent === '#c9a84c' ? '#0f1f3d' : 'white',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '4px 16px',
                    borderRadius: 40,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {plan.badge}
                </div>
              )}

              <div style={{ marginBottom: 24, marginTop: 8 }}>
                <div
                  style={{
                    display: 'inline-block',
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '3px 10px',
                    borderRadius: 40,
                    background:
                      plan.accent === '#0f1f3d'
                        ? '#e6edf8'
                        : plan.accent === '#c9a84c'
                          ? '#fdf6e3'
                          : '#eef6f4',
                    color:
                      plan.accent === '#0f1f3d'
                        ? '#0f1f3d'
                        : plan.accent === '#c9a84c'
                          ? '#7a5a00'
                          : '#2d6a4f',
                    marginBottom: 12,
                  }}
                >
                  {plan.name}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 4,
                    marginBottom: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Playfair Display, Georgia, serif',
                      fontSize: 42,
                      fontWeight: 500,
                      color: '#0f1f3d',
                      lineHeight: 1,
                    }}
                  >
                    {main}
                  </span>
                  {sub && <span style={{ fontSize: 13, color: '#718096' }}>{sub}</span>}
                </div>
                {period === 'annual' && plan.annualTotal && (
                  <p style={{ fontSize: 12, color: '#718096', marginBottom: 4 }}>
                    Billed ${plan.annualTotal.toLocaleString()} annually · 2 months free
                  </p>
                )}
                {isEstate && period === 'annual' && (() => {
                  const line = estateAnnualSavingsLine(annualBillingAvailable)
                  return line ? (
                    <p style={{ fontSize: 12, color: '#4a7c6f', fontWeight: 500 }}>{line}</p>
                  ) : null
                })()}
                <p style={{ fontSize: 13, color: '#718096', lineHeight: 1.5 }}>{plan.description}</p>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, marginBottom: 24 }}>
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    style={{
                      display: 'flex',
                      gap: 8,
                      padding: '6px 0',
                      fontSize: 13,
                      color: '#4a5568',
                      borderBottom: '1px solid #f7f8fa',
                      alignItems: 'flex-start',
                    }}
                  >
                    <span
                      style={{
                        color: plan.accent,
                        fontWeight: 700,
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              {isLoggedIn ? (
                <>
                  <p style={{ fontSize: 13, color: '#4a5568', lineHeight: 1.6, marginBottom: 12 }}>
                    {BILLING_DISCLOSURES.preCheckout(
                      plan.name,
                      plan.period === 'annual' && plan.annualTotal
                        ? `$${plan.annualTotal}`
                        : plan.priceLabel,
                      plan.intervalLabel,
                    )}
                  </p>
                  <button
                    type="button"
                    disabled={loadingCheckoutTier === plan.tier}
                    onClick={() => void handleCheckout(plan)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: 8,
                      border: 'none',
                      background: plan.accent,
                      color: plan.accent === '#c9a84c' ? '#0f1f3d' : 'white',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: loadingCheckoutTier === plan.tier ? 'wait' : 'pointer',
                      fontFamily: 'DM Sans, system-ui, sans-serif',
                      opacity: loadingCheckoutTier === plan.tier ? 0.7 : 1,
                    }}
                  >
                    {loadingCheckoutTier === plan.tier ? 'Redirecting…' : plan.cta}
                  </button>
                </>
              ) : (
                <a
                  href={signupHref}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '12px',
                    borderRadius: 8,
                    background: plan.accent,
                    color: plan.accent === '#c9a84c' ? '#0f1f3d' : 'white',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'DM Sans, system-ui, sans-serif',
                    textDecoration: 'none',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                  }}
                >
                  {isEstate ? 'Start free trial' : plan.cta}
                </a>
              )}
            </div>
          )
        })}
      </div>

      <p
        style={{
          fontSize: 12,
          color: '#718096',
          textAlign: 'center',
          marginTop: 12,
          lineHeight: 1.6,
          maxWidth: 420,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        A single estate planning attorney consultation often costs $3,000–$5,000. My Wealth Maps
        prepares you to make every minute count.
      </p>

      <p
        style={{
          fontSize: 13,
          color: '#718096',
          textAlign: 'center',
          marginTop: 16,
          lineHeight: 1.6,
          maxWidth: 640,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {BILLING_DISCLOSURES.pricingPageNotice}
      </p>
    </>
  )
}
