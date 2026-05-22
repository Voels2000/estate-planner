import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/referral/track
 *
 * Logs a referral click from an event page.
 *
 * Body:
 *   { ref: string, event_slug?: string, source_url?: string }          → advisor (default)
 *   { ref: string, event_slug?: string, source_url?: string, type: 'attorney' } → attorney
 *
 * The `type` field discriminates which directory to resolve against.
 * Unresolved codes (ref not found in directory) are logged with resolved: false.
 */
export async function POST(req: NextRequest) {
  try {
    const { ref, event_slug, source_url, type } = await req.json()

    if (!ref || typeof ref !== 'string') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const supabase = createAdminClient()
    const isAttorney = type === 'attorney'

    if (isAttorney) {
      // ── Attorney path ──────────────────────────────────────────────────────
      const { data: listing } = await supabase
        .from('attorney_listings')
        .select('id, profile_id, firm_name, contact_name')
        .eq('referral_code', ref)
        .maybeSingle()

      if (!listing) {
        await supabase.from('referral_clicks').insert({
          referral_code: ref,
          listing_type: 'attorney',
          event_slug: event_slug ?? null,
          source_url: source_url ?? null,
          advisor_id: null,
          listing_id: null,
          attorney_listing_id: null,
          attorney_profile_id: null,
          resolved: false,
        })
        return NextResponse.json({ ok: true, resolved: false })
      }

      await supabase.from('referral_clicks').insert({
        referral_code: ref,
        listing_type: 'attorney',
        event_slug: event_slug ?? null,
        source_url: source_url ?? null,
        advisor_id: null,
        listing_id: null,
        attorney_listing_id: listing.id,
        attorney_profile_id: listing.profile_id ?? null,
        resolved: true,
      })

      return NextResponse.json({
        ok: true,
        resolved: true,
        firm_name: listing.firm_name ?? listing.contact_name,
      })
    }

    // ── Advisor path (unchanged) ─────────────────────────────────────────────
    const { data: listing } = await supabase
      .from('advisor_directory')
      .select('id, profile_id, firm_name')
      .eq('referral_code', ref)
      .maybeSingle()

    if (!listing) {
      await supabase.from('referral_clicks').insert({
        referral_code: ref,
        listing_type: 'advisor',
        event_slug: event_slug ?? null,
        source_url: source_url ?? null,
        advisor_id: null,
        listing_id: null,
        resolved: false,
      })
      return NextResponse.json({ ok: true, resolved: false })
    }

    await supabase.from('referral_clicks').insert({
      referral_code: ref,
      listing_type: 'advisor',
      event_slug: event_slug ?? null,
      source_url: source_url ?? null,
      advisor_id: listing.profile_id,
      listing_id: listing.id,
      resolved: true,
    })

    return NextResponse.json({
      ok: true,
      resolved: true,
      firm_name: listing.firm_name,
    })
  } catch (err) {
    console.error('referral track error:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
