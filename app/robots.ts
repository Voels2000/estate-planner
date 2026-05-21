import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://estate-planner-gules.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/profile',
          '/income',
          '/assets',
          '/expenses',
          '/real-estate',
          '/businesses',
          '/liabilities',
          '/insurance',
          '/projections',
          '/scenarios',
          '/social-security',
          '/rmd',
          '/roth',
          '/complete',
          '/monte-carlo',
          '/my-family',
          '/titling',
          '/incapacity-planning',
          '/domicile-analysis',
          '/estate-tax',
          '/my-estate-strategy',
          '/my-estate-trust-strategy',
          '/my-advisor',
          '/my-attorney',
          '/billing',
          '/settings',
          '/print',
          '/import',
          '/admin',
          '/advisor',
          '/attorney',
          '/api/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
