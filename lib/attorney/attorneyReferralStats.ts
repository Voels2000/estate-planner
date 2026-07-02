import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ATTORNEY_EVENT_REFERRAL_GROUPS,
  ATTORNEY_NEWSLETTER_DEFAULT_BUNDLE_SLUGS,
} from '@/lib/attorney/attorneyEventReferralKit'

export type ReferralClickRow = {
  event_slug: string | null
  created_at: string
}

export type AttorneyReferralStats = {
  totalClicksAllTime: number
  clicksLast30Days: number
  clicksBySlug: Record<string, number>
  clicksByCategory: Record<string, number>
  topSlugsByClicks: string[]
  newsletterBundleSlugs: string[]
  mostClickedSlug: string | null
}

function thirtyDaysAgoIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString()
}

export function aggregateAttorneyReferralClicks(rows: ReferralClickRow[]): AttorneyReferralStats {
  const clicksBySlug: Record<string, number> = {}
  const clicksByCategory: Record<string, number> = {}
  let totalClicksAllTime = 0
  let clicksLast30Days = 0
  const since = thirtyDaysAgoIso()

  for (const row of rows) {
    totalClicksAllTime += 1
    if (row.created_at >= since) clicksLast30Days += 1

    const slug = row.event_slug?.trim()
    if (!slug) continue

    clicksBySlug[slug] = (clicksBySlug[slug] ?? 0) + 1

    const group = ATTORNEY_EVENT_REFERRAL_GROUPS.find((g) => g.slugs.includes(slug))
    if (group) {
      clicksByCategory[group.label] = (clicksByCategory[group.label] ?? 0) + 1
    }
  }

  const topSlugsByClicks = Object.entries(clicksBySlug)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([slug]) => slug)

  const newsletterBundleSlugs =
    topSlugsByClicks.length >= 1
      ? topSlugsByClicks.slice(0, 3)
      : [...ATTORNEY_NEWSLETTER_DEFAULT_BUNDLE_SLUGS]

  return {
    totalClicksAllTime,
    clicksLast30Days,
    clicksBySlug,
    clicksByCategory,
    topSlugsByClicks,
    newsletterBundleSlugs,
    mostClickedSlug: topSlugsByClicks[0] ?? null,
  }
}

export async function fetchAttorneyReferralClickRows(
  supabase: SupabaseClient,
  attorneyListingId: string,
): Promise<ReferralClickRow[]> {
  const { data, error } = await supabase
    .from('referral_clicks')
    .select('event_slug, created_at')
    .eq('listing_type', 'attorney')
    .eq('attorney_listing_id', attorneyListingId)
    .eq('resolved', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getAttorneyReferralStats(
  supabase: SupabaseClient,
  attorneyListingId: string,
): Promise<AttorneyReferralStats> {
  const rows = await fetchAttorneyReferralClickRows(supabase, attorneyListingId)
  return aggregateAttorneyReferralClicks(rows)
}
