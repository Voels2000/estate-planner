import type { MetadataRoute } from 'next'

const BASE_URL = 'https://mywealthmaps.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/event/',
          '/education',
          '/assess',
          '/find-advisor',
          '/find-attorney',
          '/pricing',
          '/privacy',
          '/terms',
        ],
        disallow: [
          '/dashboard',
          '/admin',
          '/advisor',
          '/attorney',
          '/api/',
          '/login',
          '/signup',
          '/settings',
          '/print',
          '/claim-listing',
          '/billing',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
