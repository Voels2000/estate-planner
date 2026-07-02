import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { getAttorneyListingIdForUser } from '@/lib/attorney/attorneyClientCap'
import { getAttorneyReferralStats } from '@/lib/attorney/attorneyReferralStats'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { user, isAttorney } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAttorney) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const listingId = await getAttorneyListingIdForUser(supabase, user.id)
  if (!listingId) {
    return NextResponse.json({
      totalClicksAllTime: 0,
      clicksLast30Days: 0,
      clicksBySlug: {},
      clicksByCategory: {},
      topSlugsByClicks: [],
      newsletterBundleSlugs: [],
      mostClickedSlug: null,
    })
  }

  try {
    const stats = await getAttorneyReferralStats(supabase, listingId)
    return NextResponse.json(stats)
  } catch (err) {
    console.error('[attorney/referral-stats]', err)
    return NextResponse.json({ error: 'Failed to load referral stats' }, { status: 500 })
  }
}
