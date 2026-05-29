import { createClient } from '@/lib/supabase/server'
import { getSignupHref } from '@/lib/waitlist-mode'
import { BILLING_DISCLOSURES } from '@/lib/compliance/billing-disclosures'
import { isAnnualBillingConfigured } from '@/lib/billing/stripePrices'
import { PricingConsumerPlans } from './_pricing-consumer-plans'

const ADVISOR_PLANS = [
  { name: 'Starter', price: 159, clients: '10 clients', priceId: 'price_1TAlRkCaljka9gJtL7jcTwWY' },
  { name: 'Pro', price: 299, clients: '30 clients', priceId: 'price_1TBIjWCaljka9gJt5tAXddM7', popular: true },
  { name: 'Unlimited', price: 499, clients: 'Unlimited clients', priceId: 'price_1TBIkSCaljka9gJtUqwl9reU' },
]

export default async function PricingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const signupHref = getSignupHref()
  const annualBillingAvailable = isAnnualBillingConfigured()

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#fafaf8',
        fontFamily: 'DM Sans, system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#fdf6e3',
              border: '1px solid #e8c97a',
              color: '#0f1f3d',
              fontSize: 10,
              fontWeight: 500,
              padding: '5px 16px',
              borderRadius: 40,
              marginBottom: 20,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
            }}
          >
            ✦ Simple, Transparent Pricing
          </div>
          <h1
            style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 'clamp(28px, 5vw, 42px)',
              fontWeight: 500,
              color: '#0f1f3d',
              lineHeight: 1.2,
              marginBottom: 14,
            }}
          >
            Professional planning infrastructure.
            <br />
            At a price that makes sense.
          </h1>
          <p
            style={{
              fontSize: 16,
              color: '#4a5568',
              maxWidth: 520,
              margin: '0 auto 12px',
              lineHeight: 1.7,
            }}
          >
            Estate attorneys charge $5K–$50K annually. Family offices require $30M+. My Wealth Maps
            gives $2M–$30M households the coordinated planning tool that segment has never had.
          </p>
          <p
            style={{
              fontSize: 13,
              color: '#718096',
              maxWidth: 480,
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            Starting at $29/month · Estate plan includes a 14-day free trial
            {annualBillingAvailable ? ' · Annual billing saves 2 months' : ''}
          </p>
          <p
            style={{
              fontSize: 13,
              color: '#4a7c6f',
              maxWidth: 440,
              margin: '8px auto 0',
              lineHeight: 1.6,
              fontWeight: 500,
            }}
          >
            Professional estate planning at a fraction of attorney fees
          </p>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 600,
              color: '#718096',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              marginBottom: 32,
            }}
          >
            For Individuals & Families
          </div>

          <PricingConsumerPlans
            isLoggedIn={!!user}
            signupHref={signupHref}
            annualBillingAvailable={annualBillingAvailable}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 32,
            flexWrap: 'wrap',
            margin: '32px 0 64px',
          }}
        >
          {[
            '✓ Cancel anytime',
            '✓ 14-day free trial on Estate',
            ...(annualBillingAvailable ? ['✓ Annual billing — 2 months free'] : []),
            '✓ A fraction of annual attorney fees',
          ].map((item) => (
            <div
              key={item}
              style={{
                fontSize: 12,
                color: '#718096',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {item}
            </div>
          ))}
        </div>

        <div
          style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            padding: '40px 32px',
            boxShadow: '0 4px 20px rgba(15,31,61,0.08)',
            marginBottom: 48,
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#718096',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                marginBottom: 8,
              }}
            >
              For Financial Advisors
            </div>
            <h2
              style={{
                fontFamily: 'Playfair Display, Georgia, serif',
                fontSize: 24,
                fontWeight: 500,
                color: '#0f1f3d',
                marginBottom: 8,
              }}
            >
              Advisor Plans
            </h2>
            <p style={{ fontSize: 13, color: '#718096', lineHeight: 1.6 }}>
              Full access to all features. Pricing based on number of clients. Client dashboard
              access is always free for your clients.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            {ADVISOR_PLANS.map((plan) => (
              <div
                key={plan.name}
                style={{
                  border: plan.popular ? '2px solid #0f1f3d' : '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: '24px 20px',
                  position: 'relative',
                  background: plan.popular ? '#f7f8fa' : 'white',
                }}
              >
                {plan.popular && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -13,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#0f1f3d',
                      color: 'white',
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '3px 14px',
                      borderRadius: 40,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Most Popular
                  </div>
                )}
                <div
                  style={{
                    fontFamily: 'Playfair Display, Georgia, serif',
                    fontSize: 18,
                    fontWeight: 500,
                    color: '#0f1f3d',
                    marginBottom: 4,
                  }}
                >
                  {plan.name}
                </div>
                <div style={{ fontSize: 12, color: '#718096', marginBottom: 16 }}>{plan.clients}</div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 4,
                    marginBottom: 20,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Playfair Display, Georgia, serif',
                      fontSize: 32,
                      fontWeight: 500,
                      color: '#0f1f3d',
                      lineHeight: 1,
                    }}
                  >
                    ${plan.price}
                  </span>
                  <span style={{ fontSize: 12, color: '#718096' }}>/month</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: 20 }}>
                  {[
                    'All consumer features',
                    plan.clients,
                    'Client access always free',
                    'Advisor portal',
                    'Priority support',
                  ].map((feature) => (
                    <li
                      key={feature}
                      style={{
                        fontSize: 12,
                        color: '#4a5568',
                        padding: '4px 0',
                        display: 'flex',
                        gap: 6,
                      }}
                    >
                      <span style={{ color: '#4a7c6f', fontWeight: 700 }}>✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                {user ? (
                  <>
                    <p
                      style={{
                        fontSize: 12,
                        color: '#4a5568',
                        lineHeight: 1.6,
                        marginBottom: 12,
                      }}
                    >
                      {BILLING_DISCLOSURES.preCheckout(plan.name, `$${plan.price}`, 'month')}
                    </p>
                    <form action="/api/stripe/checkout" method="POST">
                      <input type="hidden" name="priceId" value={plan.priceId} />
                      <button
                        type="submit"
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: 8,
                          border: 'none',
                          background: '#0f1f3d',
                          color: 'white',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'DM Sans, system-ui, sans-serif',
                        }}
                      >
                        Get started
                      </button>
                    </form>
                  </>
                ) : (
                  <a
                    href={signupHref}
                    style={{
                      display: 'block',
                      textAlign: 'center',
                      padding: '10px',
                      borderRadius: 8,
                      background: '#0f1f3d',
                      color: 'white',
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    Get started
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h3
            style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 22,
              color: '#0f1f3d',
              textAlign: 'center',
              marginBottom: 24,
            }}
          >
            Common Questions
          </h3>
          {[
            {
              q: 'Can I try before I pay?',
              a: 'The Estate plan includes a 14-day free trial — full access to estate tax snapshot, strategies, and the execution checklist. Financial and Retirement plans start billing when you subscribe.',
            },
            {
              q: 'Can I change plans later?',
              a: 'Yes. You can upgrade or downgrade at any time. Changes take effect at your next billing cycle.',
            },
            {
              q: 'Is my financial data secure?',
              a: 'Yes. All data is encrypted in transit and at rest. We use Supabase (built on PostgreSQL) with row-level security.',
            },
            {
              q: 'Do I need to pay if my advisor invited me?',
              a: 'No. If your financial advisor invited you as a client, your access is covered by their advisor plan.',
            },
            {
              q: 'Is this financial advice?',
              a: 'Questions about which plan fits your situation? Start with the free assessment.',
            },
          ].map((item) => (
            <div
              key={item.q}
              style={{
                borderBottom: '1px solid #e2e8f0',
                padding: '16px 0',
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#0f1f3d',
                  marginBottom: 6,
                }}
              >
                {item.q}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: '#718096',
                  lineHeight: 1.6,
                }}
              >
                {item.a}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
