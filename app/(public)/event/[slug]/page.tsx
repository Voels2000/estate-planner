import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEventContent, EVENT_SLUGS } from '@/lib/events/content'
import { getSignupHref } from '@/lib/waitlist-mode'
import type { EventContent, EventAction } from '@/lib/events/types'
import type { Metadata } from 'next'
import { ReferralTracker } from './_referral-tracker'
import { WaEstateTaxCallout } from '@/components/learn/WaEstateTaxCallout'
import { shouldShowWaEstateTaxCallout } from '@/lib/learn/wa-estate-tax'

// ── Static params for all 8 events ───────────────────────────────────────────

export async function generateStaticParams() {
  return EVENT_SLUGS.map(slug => ({ slug }))
}

// ── SEO metadata ──────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const event = getEventContent(slug)
  if (!event) return {}
  return {
    title: event.seoTitle,
    description: event.seoDescription,
    openGraph: {
      title: event.seoTitle,
      description: event.seoDescription,
      type: 'article',
    },
  }
}

// ── Urgency config ────────────────────────────────────────────────────────────

const URGENCY_CONFIG = {
  critical: { label: 'Act immediately', color: '#d85a30', bg: '#fef3ee', border: '#f9c5a1' },
  high:     { label: 'Act within 90 days', color: '#ba7517', bg: '#faeeda', border: '#f5cc7a' },
  moderate: { label: 'Plan within 6 months', color: '#4a7c6f', bg: '#eef6f4', border: '#a8d5c8' },
}

const PRIORITY_COLORS = {
  1: { bg: '#fef3ee', border: '#f9c5a1', dot: '#d85a30', label: 'Immediate' },
  2: { bg: '#faeeda', border: '#f5cc7a', dot: '#ba7517', label: 'Within 90 days' },
  3: { bg: '#f7f8fa', border: '#e2e8f0', dot: '#718096', label: 'Within 6 months' },
}

// ── Assessment mini-component ─────────────────────────────────────────────────
// Rendered as a static teaser — full interactive version is at /assess

function AssessmentTeaser({ event }: { event: EventContent }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f1f3d 0%, #1a3460 100%)',
      borderRadius: 12,
      padding: '32px',
      color: 'white',
      marginBottom: 32,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
        color: '#c9a84c', textTransform: 'uppercase', marginBottom: 10,
      }}>
        {event.assessmentQuestions.length}-Question Assessment
      </div>
      <h3 style={{
        fontFamily: 'Playfair Display, Georgia, serif',
        fontSize: 20, fontWeight: 500, marginBottom: 8,
      }}>
        How prepared are you for {event.shortTitle.toLowerCase()}?
      </h3>
      <p style={{
        fontSize: 13, color: 'rgba(255,255,255,0.65)',
        lineHeight: 1.6, marginBottom: 20,
      }}>
        Answer {event.assessmentQuestions.length} questions and get a personalized
        readiness score with specific gaps identified.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {event.assessmentQuestions.slice(0, 3).map((q, i) => (
          <div key={q.id} style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            color: 'rgba(255,255,255,0.7)',
          }}>
            {i + 1}. {q.question}
          </div>
        ))}
        {event.assessmentQuestions.length > 3 && (
          <div style={{
            fontSize: 12, color: 'rgba(255,255,255,0.4)',
            paddingLeft: 14,
          }}>
            + {event.assessmentQuestions.length - 3} more questions
          </div>
        )}
      </div>
      <a href={`/event/${event.slug}/assess`} style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: '#c9a84c', color: '#0f1f3d',
        padding: '11px 24px', borderRadius: 8,
        fontSize: 14, fontWeight: 600,
        textDecoration: 'none',
      }}>
        Take the {event.shortTitle.toLowerCase()} assessment →
      </a>
    </div>
  )
}

// ── Action card ───────────────────────────────────────────────────────────────

function ActionCard({ action, index }: { action: EventAction; index: number }) {
  const p = PRIORITY_COLORS[action.priority]
  return (
    <div style={{
      background: p.bg,
      border: `1px solid ${p.border}`,
      borderRadius: 10,
      padding: '18px 20px',
      display: 'flex',
      gap: 14,
      alignItems: 'flex-start',
    }}>
      <div style={{
        width: 28, height: 28,
        background: p.dot,
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white',
        fontSize: 12, fontWeight: 700,
        flexShrink: 0,
        marginTop: 2,
      }}>
        {index + 1}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 14, fontWeight: 600, color: '#0f1f3d',
          }}>
            {action.title}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: p.dot,
            background: 'white',
            padding: '2px 8px', borderRadius: 20,
            border: `1px solid ${p.border}`,
          }}>
            {p.label}
          </span>
          {action.urgencyDays && (
            <span style={{
              fontSize: 10, color: '#718096',
            }}>
              Within {action.urgencyDays} days
            </span>
          )}
        </div>
        <p style={{
          fontSize: 13, color: '#4a5568',
          lineHeight: 1.6, margin: 0, marginBottom: action.linkedFeature ? 10 : 0,
        }}>
          {action.description}
        </p>
        {action.linkedFeature && (
          <a href={getSignupHref({ redirectTo: action.linkedFeature })} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 12, fontWeight: 600,
            color: '#0f1f3d',
            textDecoration: 'none',
            marginTop: 6,
          }}>
            Do this in My Wealth Maps →
          </a>
        )}
        {action.professionalType && !action.linkedFeature && (
          <a href={action.professionalType === 'attorney' ? '/find-attorney' : '/find-advisor'} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 12, fontWeight: 600,
            color: '#4a7c6f',
            textDecoration: 'none',
            marginTop: 6,
          }}>
            {action.professionalType === 'attorney' ? 'Find an estate attorney →' : 'Find a financial advisor →'}
          </a>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const event = getEventContent(slug)
  if (!event) notFound()

  const urgency = URGENCY_CONFIG[event.urgency]
  const immediateActions = event.actions.filter(a => a.priority === 1)
  const soonActions = event.actions.filter(a => a.priority === 2)
  const laterActions = event.actions.filter(a => a.priority === 3)
  const signupHref = getSignupHref()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: event.seoTitle,
    description: event.seoDescription,
    author: {
      '@type': 'Organization',
      name: 'My Wealth Maps',
      url: 'https://mywealthmaps.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'My Wealth Maps',
      url: 'https://mywealthmaps.com',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://mywealthmaps.com/event/${event.slug}`,
    },
  }

  return (
    <main style={{
      fontFamily: 'DM Sans, system-ui, sans-serif',
      background: '#fafaf8',
      minHeight: '100vh',
    }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ReferralTracker slug={event.slug} />

      {/* Disclaimer */}
      <div style={{
        background: '#1a3460',
        borderLeft: '4px solid #c9a84c',
        padding: '10px 32px',
        fontSize: 11,
        color: 'rgba(255,255,255,0.65)',
      }}>
        Built for households with $2M–$30M in assets.
      </div>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(150deg, #0f1f3d 0%, #1a3460 60%, #2a4a7f 100%)',
        padding: '52px 32px 44px',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          {/* Breadcrumb */}
          <div style={{
            fontSize: 12, color: 'rgba(255,255,255,0.45)',
            marginBottom: 16,
          }}>
            <Link href="/" style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>Home</Link>
            {' / '}
            <span style={{ color: 'rgba(255,255,255,0.65)' }}>{event.title}</span>
          </div>

          {/* Urgency badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: urgency.bg,
            border: `1px solid ${urgency.border}`,
            color: urgency.color,
            fontSize: 11, fontWeight: 600,
            padding: '5px 14px', borderRadius: 40,
            marginBottom: 18,
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            {event.urgency === 'critical' ? '⚡' : event.urgency === 'high' ? '⏰' : '📋'}
            {' '}{urgency.label}
          </div>

          <h1 style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 'clamp(24px, 4vw, 40px)',
            fontWeight: 500,
            color: 'white',
            lineHeight: 1.2,
            marginBottom: 14,
          }}>
            {event.heroLine}
          </h1>

          <p style={{
            fontSize: 15,
            color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.7,
            maxWidth: 620,
            marginBottom: 28,
          }}>
            {event.subhead}
          </p>

          {/* Quick CTAs */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href={signupHref} style={{
              padding: '11px 22px',
              background: '#c9a84c', color: '#0f1f3d',
              borderRadius: 8, fontSize: 14, fontWeight: 600,
              textDecoration: 'none',
            }}>
              Build my plan →
            </a>
            <a href={`/event/${event.slug}/assess`} style={{
              padding: '11px 22px',
              background: 'rgba(255,255,255,0.1)',
              border: '1.5px solid rgba(255,255,255,0.25)',
              color: 'white',
              borderRadius: 8, fontSize: 14, fontWeight: 500,
              textDecoration: 'none',
            }}>
              Take the assessment
            </a>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px 80px' }}>

        {shouldShowWaEstateTaxCallout(slug) && <WaEstateTaxCallout variant="banner" />}

        {/* What changes */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 22, color: '#0f1f3d', marginBottom: 20,
          }}>
            What changes at the $2M–$30M level
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {event.whatChanges.map((item, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '14px 16px',
              }}>
                <div style={{
                  width: 6, height: 6,
                  background: '#c9a84c',
                  borderRadius: '50%',
                  flexShrink: 0,
                  marginTop: 6,
                }} />
                <span style={{ fontSize: 14, color: '#2d3748', lineHeight: 1.6 }}>
                  {item}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Action plan */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 22, color: '#0f1f3d', marginBottom: 6,
          }}>
            Your action plan
          </h2>
          <p style={{
            fontSize: 13, color: '#718096', marginBottom: 24, lineHeight: 1.6,
          }}>
            Ordered by urgency. Items marked &quot;Immediate&quot; should be addressed
            within {event.urgency === 'critical' ? '2–4 weeks' : '60–90 days'}.
          </p>

          {immediateActions.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#d85a30',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                marginBottom: 12,
              }}>
                ⚡ Immediate priority
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {immediateActions.map((action, i) => (
                  <ActionCard key={action.title} action={action} index={i} />
                ))}
              </div>
            </div>
          )}

          {soonActions.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#ba7517',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                marginBottom: 12,
              }}>
                ⏰ Within 90 days
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {soonActions.map((action, i) => (
                  <ActionCard key={action.title} action={action} index={immediateActions.length + i} />
                ))}
              </div>
            </div>
          )}

          {laterActions.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#718096',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                marginBottom: 12,
              }}>
                📋 Within 6 months
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {laterActions.map((action, i) => (
                  <ActionCard key={action.title} action={action} index={immediateActions.length + soonActions.length + i} />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Assessment teaser */}
        <AssessmentTeaser event={event} />

        {/* Professional CTAs */}
        {(event.advisorCTA || event.attorneyCTA) && (
          <section style={{ marginBottom: 48 }}>
            <h2 style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 22, color: '#0f1f3d', marginBottom: 20,
            }}>
              Get professional help
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: event.advisorCTA && event.attorneyCTA
                ? 'repeat(auto-fit, minmax(240px, 1fr))'
                : '1fr',
              gap: 16,
            }}>
              {event.attorneyCTA && (
                <div style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '20px',
                }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>⚖️</div>
                  <div style={{
                    fontFamily: 'Playfair Display, Georgia, serif',
                    fontSize: 16, color: '#0f1f3d', marginBottom: 6,
                  }}>
                    Find an estate attorney
                  </div>
                  <p style={{
                    fontSize: 13, color: '#718096',
                    lineHeight: 1.6, marginBottom: 14,
                  }}>
                    An estate attorney can execute the legal documents
                    and trust strategies this event requires.
                  </p>
                  <a href="/find-attorney" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '9px 18px',
                    background: '#0f1f3d', color: 'white',
                    borderRadius: 7, fontSize: 13, fontWeight: 600,
                    textDecoration: 'none',
                  }}>
                    Browse attorneys →
                  </a>
                </div>
              )}
              {event.advisorCTA && (
                <div style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '20px',
                }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🤝</div>
                  <div style={{
                    fontFamily: 'Playfair Display, Georgia, serif',
                    fontSize: 16, color: '#0f1f3d', marginBottom: 6,
                  }}>
                    Find a financial advisor
                  </div>
                  <p style={{
                    fontSize: 13, color: '#718096',
                    lineHeight: 1.6, marginBottom: 14,
                  }}>
                    A fiduciary advisor can model the financial impact
                    and coordinate strategy across your full picture.
                  </p>
                  <a href="/find-advisor" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '9px 18px',
                    background: '#4a7c6f', color: 'white',
                    borderRadius: 7, fontSize: 13, fontWeight: 600,
                    textDecoration: 'none',
                  }}>
                    Browse advisors →
                  </a>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Related events */}
        {event.relatedSlugs.length > 0 && (
          <section>
            <h2 style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 18, color: '#0f1f3d', marginBottom: 16,
            }}>
              Related situations
            </h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {event.relatedSlugs.map(relSlug => {
                const rel = getEventContent(relSlug)
                if (!rel) return null
                return (
                  <a key={relSlug} href={`/event/${relSlug}`} style={{
                    padding: '8px 16px',
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    fontSize: 13, color: '#0f1f3d',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}>
                    {rel.shortTitle} →
                  </a>
                )
              })}
            </div>
          </section>
        )}

      </div>
    </main>
  )
}
