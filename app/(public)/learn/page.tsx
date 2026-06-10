import type { Metadata } from 'next'
import Link from 'next/link'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { getAllStateEstateTaxData } from '@/lib/learn/state-estate-tax-data'
import { getRiskSummary, stateCodeToSlug } from '@/lib/learn/state-estate-tax-slugs'
import { getStaleness } from '@/lib/learn/state-estate-tax-types'

const FEATURED_STATE = 'WA'

export const metadata: Metadata = {
  title: 'Learn | Estate Planning Guides | My Wealth Maps',
  description:
    'Evergreen estate planning guides for households and professionals. State-specific tax explainers, planning concepts, and advisor-ready reference material.',
}

const dollarFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatExemptionShort(amount: number): string {
  const m = amount / 1_000_000
  return m >= 1 ? `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M` : dollarFmt.format(amount)
}

export default async function LearnIndexPage() {
  const states = await getAllStateEstateTaxData()
  const featured = states.find((s) => s.state_code === FEATURED_STATE)
  const others = states.filter((s) => s.state_code !== FEATURED_STATE)

  return (
    <div className="px-7 py-7">
      <Card className="hero card-surface border p-8 text-center">
        <div className="hero-badge">Educational Guides</div>
        <h1
          className="mt-5 text-4xl leading-tight"
          style={{ fontFamily: 'var(--font-display, Playfair Display, Georgia, serif)' }}
        >
          Learn Before You Plan.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[color:var(--text-secondary,#4a5568)]">
          Durable reference guides on state estate tax, trust strategies, and planning concepts —
          written for families, financial advisors, and estate planning attorneys.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <ButtonLink href="/education" variant="secondary">
            Interactive modules →
          </ButtonLink>
          <ButtonLink href="/assess" variant="secondary">
            Planning assessment →
          </ButtonLink>
        </div>
      </Card>

      <div className="divider mt-8" />

      <div className="pt-6">
        <h2
          className="mb-2 text-xl"
          style={{ fontFamily: 'var(--font-display, Playfair Display, Georgia, serif)', color: '#0f1f3d' }}
        >
          State estate tax guides
        </h2>
        <p className="mb-6 text-sm text-[#718096]">
          Long-form explainers for all 13 states with an estate tax — updated from a single data
          source, not copy-pasted articles.
        </p>

        {featured && (() => {
          const slug = stateCodeToSlug(featured.state_code)
          if (!slug) return null
          return (
            <Link
              href={`/learn/${slug}`}
              className="learn-featured-card block no-underline"
              style={{ textDecoration: 'none' }}
            >
              <div
                style={{
                  display: 'inline-block',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#0f1f3d',
                  background: 'rgba(15,31,61,0.08)',
                  padding: '4px 10px',
                  borderRadius: 20,
                  marginBottom: 10,
                }}
              >
                Washington residents
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display, Playfair Display, Georgia, serif)',
                  fontSize: 20,
                  fontWeight: 500,
                  color: '#0f1f3d',
                  marginBottom: 8,
                }}
              >
                {featured.state_name} Estate Tax Guide
              </div>
              <p style={{ fontSize: 13, color: '#718096', margin: '0 0 6px', lineHeight: 1.5 }}>
                {formatExemptionShort(featured.exemption_amount)} per person · Top rate{' '}
                {featured.top_rate_pct}%
              </p>
              {getRiskSummary(featured.state_code) && (
                <p style={{ fontSize: 14, color: '#4a5568', lineHeight: 1.65, margin: '0 0 10px' }}>
                  {getRiskSummary(featured.state_code)}
                </p>
              )}
              <div style={{ fontSize: 12, color: '#718096' }}>
                Last reviewed {featured.last_reviewed} · Read guide →
              </div>
            </Link>
          )
        })()}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12,
            marginTop: 24,
          }}
        >
          {others.map((state) => {
            const slug = stateCodeToSlug(state.state_code)
            if (!slug) return null
            const staleness = getStaleness(state.last_reviewed)
            return (
              <Link
                key={state.state_code}
                href={`/learn/${slug}`}
                style={{
                  display: 'block',
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '16px 18px',
                  textDecoration: 'none',
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0f1f3d', marginBottom: 4 }}>
                  {state.state_name}
                </div>
                <p style={{ fontSize: 12, color: '#718096', margin: '0 0 6px', lineHeight: 1.5 }}>
                  {formatExemptionShort(state.exemption_amount)} per person · Top rate{' '}
                  {state.top_rate_pct}%
                </p>
                {getRiskSummary(state.state_code) && (
                  <p style={{ fontSize: 12, color: '#4a5568', margin: '0 0 8px', lineHeight: 1.5 }}>
                    {getRiskSummary(state.state_code)}
                  </p>
                )}
                {staleness !== 'current' && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: staleness === 'overdue' ? '#c53030' : '#c87000',
                    }}
                  >
                    {staleness === 'overdue' ? 'Review overdue' : 'Review due'}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
