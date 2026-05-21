import type { MetadataRoute } from 'next'

// const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://estate-planner-gules.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: '/', // Block all crawlers until launch
      },
    ],
    // sitemap: `${BASE_URL}/sitemap.xml`,  // Uncomment at launch
  }
}
