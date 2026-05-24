import { createClient } from '@/lib/supabase/server'
import { getSignupHref } from '@/lib/waitlist-mode'
import { TIER_FEATURES } from '@/lib/tiers'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const CONSUMER_PLANS = [
  {
    id: 'financial',
    priceId: 'price_1TILBRCaljka9gJt6dr44Znq',
    name: 'Financial',
    price: 9,
    description: 'Get organized and see your full financial picture.',
    features: TIER_FEATURES[1],
    highlighted: false,
    accent: '#0f1f3d',
    badge: null,
  },
  {
    id: 'retirement',
    priceId: 'price_1TILEXCaljka9gJtrHqnG3bl',
    name: 'Retirement',
    price: 19,
    description: 'Optimize your retirement with advanced planning tools.',
    features: TIER_FEATURES[2],
    highlighted: true,
    accent: '#c9a84c',
    badge: 'Most Popular',
  },
  {
    id: 'estate',
    priceId: 'price_1TILGOCaljka9gJtCDLiKFHp',
    name: 'Estate',
    price: 34,
    description: 'Complete estate and advanced tax planning.',
    features: TIER_FEATURES[3],
    highlighted: false,
    accent: '#4a7c6f',
    badge: null,
  },
]

const ADVISOR_PLANS = [
  { name: 'Starter', price: 159, clients: '10 clients', priceId: 'price_1TAlRkCaljka9gJtL7jcTwWY' },
  { name: 'Pro', price: 299, clients: '30 clients', priceId: 'price_1TBIjWCaljka9gJt5tAXddM7', popular: true },
  { name: 'Unlimited', price: 499, clients: 'Unlimited clients', priceId: 'price_1TBIkSCaljka9gJtUqwl9reU' },
]

export default async function PricingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const signupHref = getSignupHref()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fafaf8',
      fontFamily: 'DM Sans, system-ui, sans-serif',
    }}>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px 80px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#fdf6e3',
            border: '1px solid #e8c97a',
            color: '#0f1f3d',
            fontSize: 10, fontWeight: 500,
            padding: '5px 16px', borderRadius: 40,
            marginBottom: 20,
            textTransform: 'uppercase', letterSpacing: '0.8px',
          }}>
            ✦ Simple, Transparent Pricing
          </div>
          <h1 style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 'clamp(28px, 5vw, 42px)',
            fontWeight: 500,
            color: '#0f1f3d',
            lineHeight: 1.2,
            marginBottom: 14,
          }}>
            Professional planning infrastructure.<br />
            At a price that makes sense.
          </h1>
          <p style={{
            fontSize: 16, color: '#4a5568',
            maxWidth: 520, margin: '0 auto 12px',
            lineHeight: 1.7,
          }}>
            Estate attorneys charge $5K–$50K annually. Family offices
            require $30M+. My Wealth Maps gives $2M–$30M households the
            coordinated planning tool that segment has never had.
          </p>
          <p style={{
            fontSize: 13, color: '#718096',
            maxWidth: 400, margin: '0 auto',
            lineHeight: 1.6,
          }}>
            All plans include a 3-day free trial. No credit card required.
          </p>
        </div>

        {/* Consumer Plans */}
        <div style={{ marginBottom: 14 }}>
          <div style={{
            textAlign: 'center',
            fontSize: 11, fontWeight: 600,
            color: '#718096',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            marginBottom: 32,
          }}>
            For Individuals & Families
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
          }}>
            {CONSUMER_PLANS.map((plan) => (
              <div
                key={plan.id}
                style={{
                  background: 'white',
                  border: plan.highlighted
                    ? `2px solid ${plan.accent}`
                    : '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: '32px 28px',
                  position: 'relative',
                  boxShadow: plan.highlighted
                    ? '0 8px 40px rgba(15,31,61,0.12)'
                    : '0 4px 20px rgba(15,31,61,0.08)',
                  overflow: 'visible',
                }}
              >
                {/* Top accent bar */}
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  height: 4,
                  background: plan.accent,
                  borderRadius: '16px 16px 0 0',
                }} />

                {/* Most Popular badge */}
                {plan.badge && (
                  <div style={{
                    position: 'absolute',
                    top: -14,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: plan.accent,
                    color: plan.accent === '#c9a84c' ? '#0f1f3d' : 'white',
                    fontSize: 11, fontWeight: 600,
                    padding: '4px 16px',
                    borderRadius: 40,
                    whiteSpace: 'nowrap',
                  }}>
                    {plan.badge}
                  </div>
                )}

                {/* Plan header */}
                <div style={{ marginBottom: 24, marginTop: 8 }}>
                  <div style={{
                    display: 'inline-block',
                    fontSize: 10, fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '3px 10px',
                    borderRadius: 40,
                    background: plan.accent === '#0f1f3d' ? '#e6edf8'
                      : plan.accent === '#c9a84c' ? '#fdf6e3'
                      : '#eef6f4',
                    color: plan.accent === '#0f1f3d' ? '#0f1f3d'
                      : plan.accent === '#c9a84c' ? '#7a5a00'
                      : '#2d6a4f',
                    marginBottom: 12,
                  }}>
                    {plan.name}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 4,
                    marginBottom: 6,
                  }}>
                    <span style={{
                      fontFamily: 'Playfair Display, Georgia, serif',
                      fontSize: 42, fontWeight: 500,
                      color: '#0f1f3d', lineHeight: 1,
                    }}>${plan.price}</span>
                    <span style={{ fontSize: 13, color: '#718096' }}>/month</span>
                  </div>
                  <p style={{
                    fontSize: 13, color: '#718096',
                    lineHeight: 1.5,
                  }}>{plan.description}</p>
                </div>

                {/* Features */}
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: 24 }}>
                  {plan.features.map((feature) => (
                    <li key={feature} style={{
                      display: 'flex',
                      gap: 8,
                      padding: '6px 0',
                      fontSize: 13,
                      color: '#4a5568',
                      borderBottom: '1px solid #f7f8fa',
                      alignItems: 'flex-start',
                    }}>
                      <span style={{
                        color: plan.accent,
                        fontWeight: 700,
                        flexShrink: 0,
                        marginTop: 1,
                      }}>✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {user ? (
                  <form action={`/api/stripe/checkout?plan=${plan.id}`} method="POST">
                    <button
                      type="submit"
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: 8,
                        border: 'none',
                        background: plan.accent,
                        color: plan.accent === '#c9a84c' ? '#0f1f3d' : 'white',
                        fontSize: 14, fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'DM Sans, system-ui, sans-serif',
                        transition: 'all 0.2s',
                      }}
                    >
                      Get started
                    </button>
                  </form>
                ) : (
                  <a href={signupHref}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '12px',
                      borderRadius: 8,
                      background: plan.accent,
                      color: plan.accent === '#c9a84c' ? '#0f1f3d' : 'white',
                      fontSize: 14, fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'DM Sans, system-ui, sans-serif',
                      textDecoration: 'none',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                    }}
                  >
                    Start free trial
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Trust signals */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 32,
          flexWrap: 'wrap',
          margin: '32px 0 64px',
        }}>
          {[
            '✓ Cancel anytime',
            '✓ 3-day free trial',
            '✓ No credit card to start',
            '✓ A fraction of annual attorney fees',
          ].map(item => (
            <div key={item} style={{
              fontSize: 12, color: '#718096',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {item}
            </div>
          ))}
        </div>

        {/* Advisor Plans */}
        <div style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          padding: '40px 32px',
          boxShadow: '0 4px 20px rgba(15,31,61,0.08)',
          marginBottom: 48,
        }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              fontSize: 11, fontWeight: 600,
              color: '#718096',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              marginBottom: 8,
            }}>
              For Financial Advisors
            </div>
            <h2 style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 24, fontWeight: 500,
              color: '#0f1f3d', marginBottom: 8,
            }}>
              Advisor Plans
            </h2>
            <p style={{ fontSize: 13, color: '#718096', lineHeight: 1.6 }}>
              Full access to all features. Pricing based on number of clients.
              Client dashboard access is always free for your clients.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}>
            {ADVISOR_PLANS.map((plan, i) => (
              <div
                key={plan.name}
                style={{
                  border: plan.popular
                    ? '2px solid #0f1f3d'
                    : '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: '24px 20px',
                  position: 'relative',
                  background: plan.popular ? '#f7f8fa' : 'white',
                }}
              >
                {plan.popular && (
                  <div style={{
                    position: 'absolute',
                    top: -13,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#0f1f3d',
                    color: 'white',
                    fontSize: 10, fontWeight: 600,
                    padding: '3px 14px',
                    borderRadius: 40,
                    whiteSpace: 'nowrap',
                  }}>
                    Most Popular
                  </div>
                )}
                <div style={{
                  fontFamily: 'Playfair Display, Georgia, serif',
                  fontSize: 18, fontWeight: 500,
                  color: '#0f1f3d', marginBottom: 4,
                }}>
                  {plan.name}
                </div>
                <div style={{
                  fontSize: 12, color: '#718096', marginBottom: 16,
                }}>
                  {plan.clients}
                </div>
                <div style={{
                  display: 'flex', alignItems: 'baseline', gap: 4,
                  marginBottom: 20,
                }}>
                  <span style={{
                    fontFamily: 'Playfair Display, Georgia, serif',
                    fontSize: 32, fontWeight: 500,
                    color: '#0f1f3d', lineHeight: 1,
                  }}>${plan.price}</span>
                  <span style={{ fontSize: 12, color: '#718096' }}>/month</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: 20 }}>
                  {[
                    'All consumer features',
                    plan.clients,
                    'Client access always free',
                    'Advisor portal',
                    'Priority support',
                  ].map(feature => (
                    <li key={feature} style={{
                      fontSize: 12, color: '#4a5568',
                      padding: '4px 0',
                      display: 'flex', gap: 6,
                    }}>
                      <span style={{ color: '#4a7c6f', fontWeight: 700 }}>✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                {user ? (
                  <form action="/api/stripe/checkout" method="POST">
                    <input type="hidden" name="priceId" value={plan.priceId} />
                    <button
                      type="submit"
                      style={{
                        width: '100%', padding: '10px',
                        borderRadius: 8, border: 'none',
                        background: '#0f1f3d', color: 'white',
                        fontSize: 13, fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'DM Sans, system-ui, sans-serif',
                      }}
                    >
                      Get started
                    </button>
                  </form>
                ) : (
                  <a href={signupHref}
                    style={{
                      display: 'block', textAlign: 'center',
                      padding: '10px', borderRadius: 8,
                      background: '#0f1f3d', color: 'white',
                      fontSize: 13, fontWeight: 600,
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

        {/* FAQ */}
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h3 style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 22, color: '#0f1f3d',
            textAlign: 'center', marginBottom: 24,
          }}>
            Common Questions
          </h3>
          {[
            {
              q: 'Can I try before I pay?',
              a: 'Yes — all plans include a 3-day free trial with full access to all features. No credit card required.',
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
          ].map(item => (
            <div key={item.q} style={{
              borderBottom: '1px solid #e2e8f0',
              padding: '16px 0',
            }}>
              <div style={{
                fontSize: 14, fontWeight: 500,
                color: '#0f1f3d', marginBottom: 6,
              }}>
                {item.q}
              </div>
              <div style={{
                fontSize: 13, color: '#718096',
                lineHeight: 1.6,
              }}>
                {item.a}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
