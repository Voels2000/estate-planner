import type { Metadata } from 'next'
import Link from 'next/link'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { WA_ESTATE_TAX_GUIDE_PATH } from '@/lib/learn/wa-estate-tax'

export const metadata: Metadata = {
  title: 'Learn | Estate Planning Guides | My Wealth Maps',
  description:
    'Evergreen estate planning guides for households and professionals. State-specific tax explainers, planning concepts, and advisor-ready reference material.',
}

const GUIDES = [
  {
    slug: 'washington-estate-tax',
    href: WA_ESTATE_TAX_GUIDE_PATH,
    featured: true,
    badge: 'Washington residents',
    title: 'Washington State Estate Tax 2026',
    description:
      'WA estate tax exemption, graduated rates, bypass trust Washington strategies, and what $3M–$10M households need to know after ESB 6347.',
    updated: 'June 2026',
  },
] as const

export default function LearnIndexPage() {
  const featured = GUIDES.filter((g) => g.featured)
  const other = GUIDES.filter((g) => !g.featured)

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
          Guides
        </h2>
        <p className="mb-6 text-sm text-[#718096]">
          Long-form explainers designed to stay current — not blog posts that age out.
        </p>

        {featured.map((guide) => (
          <Link
            key={guide.slug}
            href={guide.href}
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
              {guide.badge}
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
              {guide.title}
            </div>
            <p style={{ fontSize: 14, color: '#4a5568', lineHeight: 1.65, margin: '0 0 10px' }}>
              {guide.description}
            </p>
            <div style={{ fontSize: 12, color: '#718096' }}>
              Updated {guide.updated} · Read guide →
            </div>
          </Link>
        ))}

        {other.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {other.map((guide) => (
              <Link
                key={guide.slug}
                href={guide.href}
                style={{
                  display: 'block',
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '18px 20px',
                  textDecoration: 'none',
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0f1f3d', marginBottom: 4 }}>
                  {guide.title}
                </div>
                <p style={{ fontSize: 13, color: '#718096', margin: 0, lineHeight: 1.5 }}>
                  {guide.description}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
