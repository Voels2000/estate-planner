import type { MetadataRoute } from 'next'
import { EVENT_SLUGS } from '@/lib/events/content'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://estate-planner-gules.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/assess`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/education`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/find-advisor`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/find-attorney`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ]

  const eventRoutes: MetadataRoute.Sitemap = EVENT_SLUGS.map(slug => ({
    url: `${BASE_URL}/event/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.9,
  }))

  const assessRoutes: MetadataRoute.Sitemap = EVENT_SLUGS.map(slug => ({
    url: `${BASE_URL}/event/${slug}/assess`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [...staticRoutes, ...eventRoutes, ...assessRoutes]
}
