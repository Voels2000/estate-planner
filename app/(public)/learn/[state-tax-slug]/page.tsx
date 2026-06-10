import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { StateEstateTaxArticle } from '@/components/learn/StateEstateTaxArticle'
import { getStateEstateTaxData } from '@/lib/learn/state-estate-tax-data'
import { STATE_SLUG_MAP, STATE_SLUGS } from '@/lib/learn/state-estate-tax-slugs'

const BASE_URL = 'https://mywealthmaps.com'

export async function generateStaticParams() {
  return STATE_SLUGS.map((slug) => ({ 'state-tax-slug': slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ 'state-tax-slug': string }>
}): Promise<Metadata> {
  const { 'state-tax-slug': slug } = await params
  const stateCode = STATE_SLUG_MAP[slug]
  if (!stateCode) return {}

  const data = await getStateEstateTaxData(stateCode)
  if (!data) return {}

  const year = new Date().getFullYear()
  const exemptionM = (data.exemption_amount / 1_000_000).toFixed(1)
  const title = `${data.state_name} Estate Tax Guide ${year}: Exemption, Rates & Planning`
  const description = `${data.state_name}'s estate tax exemption is $${exemptionM}M with a top rate of ${data.top_rate_pct}%. Learn how bypass trusts and planning strategies reduce your exposure.`

  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/learn/${slug}` },
    openGraph: {
      title: `${data.state_name} Estate Tax ${year}`,
      description: `Exemption: $${exemptionM}M | Top rate: ${data.top_rate_pct}%`,
      type: 'article',
      url: `${BASE_URL}/learn/${slug}`,
    },
  }
}

export default async function StateEstateTaxPage({
  params,
}: {
  params: Promise<{ 'state-tax-slug': string }>
}) {
  const { 'state-tax-slug': slug } = await params
  const stateCode = STATE_SLUG_MAP[slug]
  if (!stateCode) notFound()

  const data = await getStateEstateTaxData(stateCode)
  if (!data) notFound()

  const exemptionM = (data.exemption_amount / 1_000_000).toFixed(1)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${data.state_name} Estate Tax: What Every $${exemptionM}M+ Household Needs to Know`,
    description: `${data.state_name}'s estate tax exemption is $${exemptionM}M with a top rate of ${data.top_rate_pct}%.`,
    dateModified: data.last_reviewed,
    author: {
      '@type': 'Organization',
      name: 'My Wealth Maps',
      url: BASE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'My Wealth Maps',
      url: BASE_URL,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${BASE_URL}/learn/${slug}`,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div style={{ padding: '0 0 8px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 24px 0' }}>
          <Link href="/learn" style={{ fontSize: 12, color: '#718096', textDecoration: 'none' }}>
            ← All guides
          </Link>
        </div>
      </div>
      <StateEstateTaxArticle data={data} />
    </>
  )
}
