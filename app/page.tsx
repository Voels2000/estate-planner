import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { getSignupHref, isWaitlistMode } from '@/lib/waitlist-mode'
import { DISCLAIMER_STRINGS } from '@/lib/compliance/language-policy'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const signupHref = getSignupHref()
    const label = isWaitlistMode() ? 'Join waitlist' : 'Get started'

    return (
      <main style={{ fontFamily: 'var(--font-body)', background: 'var(--mwm-off-white)', minHeight: '100vh' }}>

      {/* NAV */}
      <nav style={{
        background: 'var(--mwm-navy)',
        padding: '14px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 20px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36,
            background: 'var(--mwm-gold)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)',
            fontWeight: 600, fontSize: 16,
            color: 'var(--mwm-navy)',
            flexShrink: 0,
          }}>M</div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 17, fontWeight: 500,
              color: 'white', lineHeight: 1.2,
            }}>My Wealth Maps</div>
            <div style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.45)',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}>mywealthmaps.com</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ButtonLink
            href="/login"
            variant="secondary"
            size="sm"
            className="!border-white/20 !bg-transparent !text-white/80 hover:!text-white hover:!border-white/40"
          >
            Sign In
          </ButtonLink>
          <ButtonLink
            href={signupHref}
            variant="primary"
            size="sm"
            className="!bg-[#c9a84c] !text-[#0f1f3d] hover:!bg-[#e8c97a] font-semibold"
          >
            {label}
          </ButtonLink>
        </div>
      </nav>

      {/* DISCLAIMER */}
      <div style={{
        background: 'var(--mwm-navy-light)',
        borderLeft: '4px solid var(--mwm-gold)',
        padding: '11px 32px',
        fontSize: 11,
        color: 'rgba(255,255,255,0.65)',
        lineHeight: 1.5,
      }}>
        {DISCLAIMER_STRINGS.footer}
      </div>

      {/* HERO */}
      <div style={{
        background: 'linear-gradient(150deg, var(--mwm-navy) 0%, var(--mwm-navy-light) 55%, var(--mwm-navy-mid) 100%)',
        padding: '52px 32px 44px',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(201,168,76,0.15)',
          border: '1px solid rgba(201,168,76,0.35)',
          color: '#e8c97a',
          fontSize: 10, fontWeight: 500,
          padding: '5px 16px', borderRadius: 40,
          marginBottom: 20,
          textTransform: 'uppercase', letterSpacing: '0.8px',
        }}>
          ✦ Financial · Retirement · Estate
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(28px, 5vw, 44px)',
          fontWeight: 500,
          color: 'white',
          lineHeight: 1.2,
          marginBottom: 14,
        }}>
          Estate planning built for<br />
          <span style={{ color: 'var(--mwm-gold)' }}>$2M–$30M households</span>.
        </h1>
        <p style={{
          fontSize: 16,
          color: 'rgba(255,255,255,0.65)',
          maxWidth: 520,
          margin: '0 auto 16px',
          lineHeight: 1.7,
        }}>
          The first self-guided planning tool built for the complexity
          your household actually faces — business interests, multiple
          properties, estate tax exposure, and a professional network
          that needs to work together.
        </p>
        <p style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.45)',
          maxWidth: 420,
          margin: '0 auto 32px',
          lineHeight: 1.6,
        }}>
          Not LegalZoom. Not a family office. The coordinated planning
          infrastructure this segment has never had — at $50–200/month
          vs $5K–50K in annual professional fees.
        </p>
        <div style={{
          display: 'flex', gap: 12,
          justifyContent: 'center', flexWrap: 'wrap',
          marginBottom: 24,
        }}>
          {[
            'Estate tax exposure modeled by state',
            'Business interests, real estate, trusts',
            'Advisor + attorney coordination tools',
            '100% private — your data stays yours',
          ].map((item) => (
            <div key={item} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              color: 'rgba(255,255,255,0.55)', fontSize: 12,
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'var(--mwm-sage-light)', flexShrink: 0,
              }} />
              {item}
            </div>
          ))}
        </div>
        <a href="/login" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 40, padding: '7px 16px',
          fontSize: 11, color: 'rgba(255,255,255,0.6)',
          textDecoration: 'none',
        }}>
          <div style={{
            width: 6, height: 6,
            background: 'var(--mwm-sage-light)',
            borderRadius: '50%',
          }} />
          Returning user? Sign in to resume where you left off →
        </a>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px 80px' }}>

        {/* ORIENTING QUESTION */}
        <div style={{
          background: 'white',
          borderRadius: 12,
          boxShadow: 'var(--mwm-shadow-lg)',
          padding: '24px',
          transform: 'translateY(-20px)',
          border: '1px solid var(--mwm-border)',
          marginBottom: 4,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 600,
            color: 'var(--mwm-text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.5px',
            marginBottom: 10,
          }}>
            Quick start — where are you today?
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 17, color: 'var(--mwm-navy)',
            marginBottom: 16,
          }}>
            Something just changed. Or it&apos;s been too long. Where are you right now?
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 10,
          }}>
            {[
              {
                icon: '⚡',
                label: 'Something just happened in my life',
                sub: 'Business sale, inheritance, divorce, health event — see what changes',
                href: '/event/selling-a-business',
              },
              {
                icon: '🔍',
                label: "I don't know where I stand",
                sub: 'Take the 8-minute assessment and get your planning score',
                href: '/assess',
              },
              {
                icon: '🗂️',
                label: 'I want to build my plan',
                sub: 'Start organizing your estate, retirement, and financial picture',
                href: getSignupHref({ intent: 'plan' }),
              },
            ].map((opt) => (
              <a
                key={opt.label}
                href={opt.href}
                style={{
                  display: 'block',
                  background: 'var(--mwm-off-white)',
                  border: '2px solid var(--mwm-border)',
                  borderRadius: 8,
                  padding: '14px',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 6 }}>{opt.icon}</div>
                <div style={{
                  fontSize: 13, fontWeight: 500,
                  color: 'var(--mwm-navy)', marginBottom: 3,
                }}>
                  {opt.label}
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'var(--mwm-text-muted)',
                  lineHeight: 1.4,
                }}>
                  {opt.sub}
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* THREE PATH CARDS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}>
          {[
            {
              accentColor: '#0f1f3d',
              badgeBg: '#e6edf8',
              badgeColor: '#0f1f3d',
              label: 'Planning Tool',
              icon: '🗂️',
              title: 'Build My Plan',
              desc: 'Create and manage your financial, retirement, and estate plans in one place.',
              features: [
                'Financial planning dashboard',
                'Retirement projections',
                'Estate document organizer',
                'Beneficiary tracker',
              ],
              checkColor: '#0f1f3d',
              cta: 'Go to My Plan →',
              href: getSignupHref({ intent: 'plan' }),
              btnClass: '!bg-[#0f1f3d] !text-white hover:!bg-[#1a3460] w-full justify-center text-xs',
              locked: true,
            },
            {
              accentColor: '#c9a84c',
              badgeBg: '#fdf6e3',
              badgeColor: '#7a5a00',
              label: 'Education',
              icon: '📚',
              title: 'Educate Myself',
              desc: 'Explore planning concepts in plain English before making any decisions.',
              features: [
                '20+ learning modules',
                'Interactive decision tree',
                'Strategy library with pros & cons',
                'Advisor prep tools',
              ],
              checkColor: '#c9a84c',
              cta: 'Start Learning →',
              href: '/education',
              btnClass: '!bg-[#c9a84c] !text-[#0f1f3d] hover:!bg-[#e8c97a] w-full justify-center text-xs font-semibold',
              locked: false,
            },
            {
              accentColor: '#4a7c6f',
              badgeBg: '#eef6f4',
              badgeColor: '#2d6a4f',
              label: 'Assessment',
              icon: '🔍',
              title: 'Assess My Needs',
              desc: 'Answer guided questions to understand where your planning stands today.',
              features: [
                'Planning gap analysis',
                'Personalized priority report',
                'Document readiness check',
                'Professional referral guide',
              ],
              checkColor: '#4a7c6f',
              cta: 'Start Assessment →',
              href: '/assess',
              btnClass: '!bg-[#4a7c6f] !text-white hover:!bg-[#6aab9a] w-full justify-center text-xs',
              locked: false,
            },
          ].map((card) => (
            <Card key={card.title} className="overflow-hidden" hover>
              <div style={{
                height: 4,
                background: card.accentColor,
                borderRadius: '12px 12px 0 0',
              }} />
              <div style={{ padding: '20px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{
                    display: 'inline-block',
                    fontSize: 9, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.6px',
                    padding: '3px 10px', borderRadius: 20,
                    background: card.badgeBg,
                    color: card.badgeColor,
                    marginBottom: 10,
                  }}>
                    {card.label}
                  </div>
                  {card.locked && (
                    <span style={{ fontSize: 12 }}>🔒</span>
                  )}
                </div>
                <div style={{ fontSize: 26, marginBottom: 8 }}>{card.icon}</div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 16, color: 'var(--mwm-navy)',
                  marginBottom: 6,
                }}>
                  {card.title}
                </div>
                <p style={{
                  fontSize: 12,
                  color: 'var(--mwm-text-muted)',
                  lineHeight: 1.5, marginBottom: 14,
                }}>
                  {card.desc}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: 16 }}>
                  {card.features.map((f) => (
                    <li key={f} style={{
                      fontSize: 11,
                      color: 'var(--mwm-text-secondary)',
                      padding: '3px 0',
                      display: 'flex', gap: 6,
                    }}>
                      <span style={{ color: card.checkColor, fontWeight: 700 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <ButtonLink
                  href={card.href}
                  variant="primary"
                  className={card.btnClass}
                >
                  {card.cta}
                </ButtonLink>
              </div>
            </Card>
          ))}
        </div>

        {/* JOURNEY STRIP */}
        <Card className="mb-6 p-5">
          <div style={{
            fontSize: 10, fontWeight: 600,
            color: 'var(--mwm-text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.5px',
            marginBottom: 14,
          }}>
            Your planning journey — how most people progress
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {[
              'Assess your gaps',
              'Learn key concepts',
              'Build your plan',
              'Meet advisors',
              'Maintain & review',
            ].map((step, i) => (
              <div
                key={step}
                style={{ display: 'flex', alignItems: 'center', flex: 1 }}
              >
                <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: i === 0 ? '#4a7c6f' : i === 1 ? '#0f1f3d' : '#f7f8fa',
                    border: `2px solid ${i === 0 ? '#4a7c6f' : i === 1 ? '#0f1f3d' : '#e2e8f0'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    color: i <= 1 ? 'white' : '#718096',
                    margin: '0 auto 6px',
                  }}>
                    {i === 0 ? '✓' : i + 1}
                  </div>
                  <div style={{
                    fontSize: 9,
                    color: i === 1 ? '#0f1f3d' : '#718096',
                    fontWeight: i === 1 ? 600 : 400,
                    lineHeight: 1.3,
                    maxWidth: 60,
                    textAlign: 'center',
                  }}>
                    {step}
                  </div>
                </div>
                {i < 4 && (
                  <div style={{
                    flex: 1, height: 2,
                    background: i === 0 ? '#4a7c6f' : '#e2e8f0',
                    margin: '0 4px',
                    marginBottom: 20,
                  }} />
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* FIND A PROFESSIONAL */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 10, fontWeight: 600,
            color: 'var(--mwm-text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.5px',
            marginBottom: 12,
          }}>
            Find a professional
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
          }}>
            {[
              {
                icon: '🤝',
                accentColor: '#0f1f3d',
                badgeBg: '#e6edf8',
                badgeColor: '#0f1f3d',
                label: 'Advisor Directory',
                title: 'Find a Financial Advisor',
                desc: 'Browse verified financial advisors who specialize in estate, retirement, and wealth planning.',
                features: [
                  'Fiduciary and fee-only options',
                  'Filter by state and specialty',
                  'Remote-friendly advisors',
                  'Send a connection request',
                ],
                checkColor: '#0f1f3d',
                cta: 'Browse Advisors →',
                href: '/find-advisor',
                btnClass: '!bg-[#0f1f3d] !text-white hover:!bg-[#1a3460] w-full justify-center text-xs',
              },
              {
                icon: '⚖️',
                accentColor: '#4a7c6f',
                badgeBg: '#eef6f4',
                badgeColor: '#2d6a4f',
                label: 'Attorney Directory',
                title: 'Find an Estate Attorney',
                desc: 'Connect with verified estate planning attorneys who can draft wills, trusts, and legal documents.',
                features: [
                  'Licensed by state',
                  'Estate planning specialists',
                  'Remote consultations available',
                  'Send a connection request',
                ],
                checkColor: '#4a7c6f',
                cta: 'Browse Attorneys →',
                href: '/find-attorney',
                btnClass: '!bg-[#4a7c6f] !text-white hover:!bg-[#6aab9a] w-full justify-center text-xs',
              },
            ].map((card) => (
              <Card key={card.title} className="overflow-hidden" hover>
                <div style={{
                  height: 4,
                  background: card.accentColor,
                  borderRadius: '12px 12px 0 0',
                }} />
                <div style={{ padding: '20px 18px' }}>
                  <div style={{
                    display: 'inline-block',
                    fontSize: 9, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.6px',
                    padding: '3px 10px', borderRadius: 20,
                    background: card.badgeBg,
                    color: card.badgeColor,
                    marginBottom: 10,
                  }}>
                    {card.label}
                  </div>
                  <div style={{ fontSize: 26, marginBottom: 8 }}>{card.icon}</div>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 16, color: 'var(--mwm-navy)',
                    marginBottom: 6,
                  }}>
                    {card.title}
                  </div>
                  <p style={{
                    fontSize: 12,
                    color: 'var(--mwm-text-muted)',
                    lineHeight: 1.5, marginBottom: 14,
                  }}>
                    {card.desc}
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, marginBottom: 16 }}>
                    {card.features.map((f) => (
                      <li key={f} style={{
                        fontSize: 11,
                        color: 'var(--mwm-text-secondary)',
                        padding: '3px 0',
                        display: 'flex', gap: 6,
                      }}>
                        <span style={{ color: card.checkColor, fontWeight: 700 }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <ButtonLink
                    href={card.href}
                    variant="primary"
                    className={card.btnClass}
                  >
                    {card.cta}
                  </ButtonLink>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* STATS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}>
          {[
            { num: '50%+', label: 'of $2M–$30M households have no estate plan at all' },
            { num: '$5K–$50K', label: 'typical annual spend on estate attorneys — our tool costs a fraction' },
            { num: '8 min', label: 'to get your personalized planning readiness score' },
          ].map((stat) => (
            <Card key={stat.num} className="p-5 text-center">
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 28, color: 'var(--mwm-navy)',
                marginBottom: 4,
              }}>
                {stat.num}
              </div>
              <div style={{
                fontSize: 11,
                color: 'var(--mwm-text-muted)',
                lineHeight: 1.4,
              }}>
                {stat.label}
              </div>
            </Card>
          ))}
        </div>

        {/* SOCIAL PROOF */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 10, fontWeight: 600,
            color: 'var(--mwm-text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.5px',
            marginBottom: 16, textAlign: 'center',
          }}>
            Built for households like these
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
            marginBottom: 20,
          }}>
            {[
              {
                quote: 'I\'ve been meaning to update my estate plan for three years. This finally gave me a clear picture of what I was missing — and what to ask my attorney.',
                name: 'Business owner',
                detail: '$6M estate · Texas',
                initial: 'B',
                color: '#0f1f3d',
              },
              {
                quote: 'After my RSU vests I realized I had no idea what my estate tax exposure actually was. The snapshot was the first thing that made it concrete.',
                name: 'Tech executive',
                detail: '$4M estate · California',
                initial: 'T',
                color: '#4a7c6f',
              },
              {
                quote: 'My advisor actually thanked me for arriving with all this organized. We got more done in 90 minutes than we had in years.',
                name: 'Real estate investor',
                detail: '$12M estate · Florida',
                initial: 'R',
                color: '#c9a84c',
              },
            ].map(item => (
              <div key={item.name} style={{
                background: 'white',
                border: '1px solid var(--mwm-border)',
                borderRadius: 12,
                padding: '20px',
                boxShadow: '0 2px 12px rgba(15,31,61,0.06)',
              }}>
                <div style={{
                  fontSize: 24, color: item.color,
                  marginBottom: 10, lineHeight: 1,
                  fontFamily: 'Georgia, serif',
                }}>"</div>
                <p style={{
                  fontSize: 13,
                  color: 'var(--mwm-text-secondary)',
                  lineHeight: 1.7,
                  marginBottom: 16,
                  fontStyle: 'italic',
                }}>
                  {item.quote}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: item.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: 'white',
                    flexShrink: 0,
                  }}>
                    {item.initial}
                  </div>
                  <div>
                    <div style={{
                      fontSize: 12, fontWeight: 600,
                      color: 'var(--mwm-navy)',
                    }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--mwm-text-muted)' }}>
                      {item.detail}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{
            background: 'white',
            border: '1px solid var(--mwm-border)',
            borderRadius: 10,
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 32,
            flexWrap: 'wrap',
          }}>
            {[
              { num: '$2M–$30M', label: 'target household range' },
              { num: '3 tiers', label: 'Financial · Retirement · Estate' },
              { num: '100%', label: 'private — your data is never sold' },
            ].map(item => (
              <div key={item.num} style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 16, fontWeight: 500,
                  color: 'var(--mwm-navy)',
                }}>
                  {item.num}
                </div>
                <div style={{ fontSize: 11, color: 'var(--mwm-text-muted)' }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ADVISOR STRIP */}
        <div style={{
          background: 'linear-gradient(135deg, #0f1f3d 0%, #2a4a7f 100%)',
          borderRadius: 12,
          padding: '28px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{
              fontSize: 9, color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase', letterSpacing: '0.6px',
              marginBottom: 4,
            }}>
              Your advisor will thank you
            </div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20, color: 'white', marginBottom: 6,
            }}>
              Arrive prepared. Not starting from scratch.
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              A client with a completed household profile, current estate
              tax snapshot, and specific questions turns a 3-hour meeting
              into 90 minutes.
            </div>
          </div>
          <ButtonLink
            href="/find-advisor"
            variant="primary"
            className="!bg-[#c9a84c] !text-[#0f1f3d] hover:!bg-[#e8c97a] font-semibold whitespace-nowrap"
          >
            Find an Advisor →
          </ButtonLink>
        </div>

      </div>
      </main>
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/profile')
  }

    redirect('/dashboard')
}
