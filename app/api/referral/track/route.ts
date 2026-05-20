import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { ref, event_slug, source_url } = await req.json()
    if (!ref || typeof ref !== 'string') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: listing } = await supabase
      .from('advisor_directory')
      .select('id, profile_id, firm_name')
      .eq('referral_code', ref)
      .maybeSingle()

    if (!listing) {
      await supabase.from('referral_clicks').insert({
        referral_code: ref,
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
