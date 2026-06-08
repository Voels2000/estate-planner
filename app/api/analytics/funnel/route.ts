import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/analytics/funnel
 *
 * Captures a funnel event. Called from client components — never blocks UI.
 *
 * Key events:
 *   event_page_view        — user landed on /event/[slug]
 *   event_assess_start     — user started /event/[slug]/assess
 *   event_assess_complete  — user completed event assessment
 *   email_captured         — user submitted email on assess results
 *   account_created        — user signed up (fired from signup form)
 *   beta_signup_link_viewed — private beta signup URL opened (waitlist bypass)
 *   tier_upgraded          — user upgraded to a paid tier
 *   advisor_connected      — user connected an advisor
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      event_name,
      event_slug,
      referral_code,
      source_url,
      properties = {},
    } = body

    if (!event_name || typeof event_name !== 'string') {
      return NextResponse.json({ error: 'event_name required' }, { status: 400 })
    }

    let userId: string | null = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id ?? null
    } catch {
      // anon visitor — that's fine
    }

    const sessionId = body.session_id
      ?? req.headers.get('x-vercel-id')
      ?? req.headers.get('x-forwarded-for')?.split(',')[0]
      ?? null

    const admin = createAdminClient()
    const { error } = await admin.from('funnel_events').insert({
      event_name,
      user_id: userId,
      session_id: sessionId,
      event_slug: event_slug ?? null,
      referral_code: referral_code ?? null,
      source_url: source_url ?? null,
      properties: {
        ...properties,
        user_agent: req.headers.get('user-agent') ?? null,
      },
    })

    if (error) {
      console.error('funnel_events insert error:', error)
      return NextResponse.json({ error: 'Could not save' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('funnel route error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
