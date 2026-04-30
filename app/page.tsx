import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
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
            href="/signup"
            variant="primary"
            size="sm"
            className="!bg-[#c9a84c] !text-[#0f1f3d] hover:!bg-[#e8c97a] font-semibold"
          >
            Get Started
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
        <span style={{ color: 'var(--mwm-gold)', fontWeight: 500 }}>
          Educational platform only.
        </span>
        {' '}Nothing here constitutes financial, legal, tax, or investment
        advice. Always consult a licensed professional before making any
        planning decisions.
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
          Plan with{' '}
          <span style={{ color: 'var(--mwm-gold)' }}>Confidence</span>.<br />
          Learn Before You Leap.
        </h1>
        <p style={{
          fontSize: 16,
          color: 'rgba(255,255,255,0.65)',
          maxWidth: 500,
          margin: '0 auto 32px',
          lineHeight: 1.7,
        }}>
          Understand your financial, retirement, and estate planning
          options in plain English — then build your plan with confidence.
        </p>
        <div style={{
          display: 'flex', gap: 12,
          justifyContent: 'center', flexWrap: 'wrap',
          marginBottom: 24,
        }}>
          {[
            '20 guided learning modules',
            'Planning readiness assessment',
            'Advisor-ready tools',
            '100% private',
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
            Which best describes what you&apos;re looking for right now?
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 10,
          }}>
            {[
              {
                icon: '🗂️',
                label: 'I want to build or update my plan',
                sub: 'Ready to work on my financial documents',
                href: '/signup?intent=plan',
              },
              {
                icon: '📚',
                label: 'I want to learn before I decide',
                sub: 'Understand my options before taking action',
                href: '/education',
              },
              {
                icon: '🔍',
                label: "I'm not sure where I stand",
                sub: 'Help me assess my current planning situation',
                href: '/assess',
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
              href: '/signup?intent=plan',
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
                '12 guided learning modules',
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

        {/* STATS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}>
          {[
            { num: '47%', label: 'of Americans have no estate plan at all' },
            { num: '$0', label: 'cost to educate yourself before meeting an advisor' },
            { num: '8 min', label: 'to complete your planning needs assessment' },
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
              Ready to take action?
            </div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20, color: 'white', marginBottom: 6,
            }}>
              Connect with a licensed professional
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              Estate attorneys, CFP® advisors, and CPAs in your area
            </div>
          </div>
          <ButtonLink
            href="/advisor-directory"
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
