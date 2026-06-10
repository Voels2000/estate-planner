import type { Metadata } from 'next'
import Link from 'next/link'
import { WashingtonEstateTaxArticle } from '@/components/learn/WashingtonEstateTaxArticle'
import { WA_ESTATE_TAX_SEO } from '@/lib/learn/wa-estate-tax'

export const metadata: Metadata = {
  title: WA_ESTATE_TAX_SEO.title,
  description: WA_ESTATE_TAX_SEO.description,
  openGraph: {
    title: WA_ESTATE_TAX_SEO.title,
    description: WA_ESTATE_TAX_SEO.description,
    type: 'article',
    url: 'https://mywealthmaps.com/learn/washington-estate-tax',
  },
  alternates: {
    canonical: 'https://mywealthmaps.com/learn/washington-estate-tax',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Washington State Estate Tax: What Every $3M+ Household Needs to Know',
  description: WA_ESTATE_TAX_SEO.description,
  dateModified: '2026-06-01',
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
    '@id': 'https://mywealthmaps.com/learn/washington-estate-tax',
  },
  about: [
    'Washington state estate tax 2026',
    'WA estate tax exemption',
    'bypass trust Washington',
  ],
}

export default function WashingtonEstateTaxPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div style={{ padding: '0 0 8px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 24px 0' }}>
          <Link
            href="/learn"
            style={{
              fontSize: 12,
              color: '#718096',
              textDecoration: 'none',
            }}
          >
            ← All guides
          </Link>
        </div>
      </div>
      <WashingtonEstateTaxArticle />
    </>
  )
}
