import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'

export async function GET() {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: listing } = await supabase
      .from('advisor_directory')
      .select('id, referral_code')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (!listing?.referral_code) {
      return NextResponse.json({
        clicks: 0,
        signups: 0,
        connected: 0,
        recentActivity: [],
        period: 'last 30 days',
      })
    }

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const since = thirtyDaysAgo.toISOString()

    const [{ count: clicks }, { count: signups }, { count: connected }, { data: recentClicks }] =
      await Promise.all([
        supabase
          .from('referral_clicks')
          .select('*', { count: 'exact', head: true })
          .eq('listing_id', listing.id)
          .eq('listing_type', 'advisor')
          .gte('created_at', since),
        admin
          .from('funnel_events')
          .select('*', { count: 'exact', head: true })
          .eq('event_name', 'account_created')
          .eq('referral_code', listing.referral_code)
          .gte('created_at', since),
        supabase
          .from('advisor_clients')
          .select('*', { count: 'exact', head: true })
          .eq('advisor_id', user.id)
          .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES]),
        supabase
          .from('referral_clicks')
          .select('created_at, event_slug, source_url')
          .eq('listing_id', listing.id)
          .eq('listing_type', 'advisor')
          .order('created_at', { ascending: false })
          .limit(5),
      ])

    return NextResponse.json({
      clicks: clicks ?? 0,
      signups: signups ?? 0,
      connected: connected ?? 0,
      recentActivity: (recentClicks ?? []).map((row) => ({
        clicked_at: row.created_at,
        event_slug: row.event_slug,
        source: row.source_url,
      })),
      period: 'last 30 days',
    })
  } catch (err) {
    console.error('Referral impact error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
