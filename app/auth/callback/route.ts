import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  // Path A: PKCE code exchange (standard OAuth/magic link flow)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(`${origin}/forgot-password?error=expired`)
    }
  }
  // Path B: token_hash / OTP flow (some Supabase email templates send this instead)
  else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as never })
    if (error) {
      return NextResponse.redirect(`${origin}/forgot-password?error=expired`)
    }
  }
  // Neither — nothing to exchange
  else {
    return NextResponse.redirect(`${origin}/forgot-password?error=expired`)
  }

  // Session is now established. Fetch the user to determine correct redirect.
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  // Fetch profile and household to determine correct redirect
  let { data: profile } = await supabase
    .from('profiles')
    .select('role, subscription_status, firm_id')
    .eq('id', user.id)
    .single()

  // Attorneys — no billing, no household. Route straight to attorney portal.
  // Honor ?next param for deep linking (e.g. /attorney/dashboard?connection=pending)
  if (profile?.role === 'attorney') {
  
  // Check if this attorney was requested by a consumer via the request-add flow.
  // If so, activate their listing and notify the requesting consumer.
  try {
    const admin = createAdminClient()

    const { data: pendingListing } = await admin
      .from('attorney_listings')
      .select('id, requested_by, contact_name')
      .eq('email', user.email!)
      .eq('is_active', false)
      .not('requested_by', 'is', null)
      .maybeSingle()

    if (pendingListing?.requested_by) {
      // Activate the listing now that the attorney has a platform account
      await admin
        .from('attorney_listings')
        .update({ is_active: true, profile_id: user.id })
        .eq('id', pendingListing.id)

      // Fetch the requesting consumer's profile for notification
      const { data: consumerProfile } = await admin
        .from('profiles')
        .select('full_name, email')
        .eq('id', pendingListing.requested_by)
        .single()

      const attorneyName = pendingListing.contact_name ?? 'The attorney you requested'

      // In-app notification to consumer
      await admin.from('notifications').insert({
        user_id: pendingListing.requested_by,
        type: 'attorney_access_granted',
        title: 'Your requested attorney has joined',
        body: `${attorneyName} has joined the platform. You can now connect with them from the attorney directory.`,
        delivery: 'in_app',
        read: false,
      })

      // Email notification to consumer
      if (consumerProfile?.email) {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/email/attorney-notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: consumerProfile.email,
            attorneyName,
            consumerName: consumerProfile.full_name ?? 'there',
            message: `${attorneyName} has joined the platform. Log in and visit the attorney directory to connect with them.`,
          }),
        })
      }
    }
  } catch (err) {
    // Non-fatal — attorney routing should never be blocked by notification failure
    console.error('attorney join notification error:', err)
  }

    const attorneyNext = next !== '/dashboard' ? next : '/terms?returnTo=/attorney'
    return NextResponse.redirect(`${origin}${attorneyNext}`)
  }

  // Advisors — route based on subscription status
  if (profile?.role === 'advisor') {
    const inviteTokenCb = searchParams.get('invite_token')
    const firmIdCb = searchParams.get('firm_id')
    if (inviteTokenCb && firmIdCb) {
      try {
        await fetch(`${origin}/api/firm/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: request.headers.get('cookie') ?? '',
          },
          body: JSON.stringify({ invite_token: inviteTokenCb, firm_id: firmIdCb }),
        })
      } catch (err) {
        console.error('firm join (callback):', err)
      }
      const { data: refreshed } = await supabase
        .from('profiles')
        .select('role, subscription_status, firm_id')
        .eq('id', user.id)
        .single()
      if (refreshed) profile = refreshed
    }

    if (!profile?.firm_id) {
      try {
        const sb = await createClient()
        const email = user.email ?? ''
        const prefix = email.includes('@')
          ? email.slice(0, email.indexOf('@')).trim()
          : email.trim() || 'Advisor'
        const defaultFirmName = `${prefix} Firm`

        const { data: newFirm, error: firmError } = await sb
          .from('firms')
          .insert({
            name: defaultFirmName,
            owner_id: user.id,
            tier: 'starter',
            seat_count: 1,
            subscription_status: null,
          })
          .select('id')
          .single()

        if (firmError) throw firmError
        if (!newFirm?.id) throw new Error('firm insert returned no id')

        const { error: memberError } = await sb.from('firm_members').insert({
          firm_id: newFirm.id,
          user_id: user.id,
          firm_role: 'owner',
          status: 'active',
          joined_at: new Date().toISOString(),
        })
        if (memberError) throw memberError

        const { error: profileError } = await sb
          .from('profiles')
          .update({ firm_id: newFirm.id, firm_role: 'owner' })
          .eq('id', user.id)
        if (profileError) throw profileError
      } catch (err) {
        console.error('advisor firm bootstrap error:', err)
      }
    }

    const hasActiveSub = ['active', 'trialing', 'canceling'].includes(
      profile.subscription_status ?? ''
    )
    if (!hasActiveSub) {
      // No subscription yet — go to billing
      return NextResponse.redirect(`${origin}/billing`)
    }
    // Has subscription — go to advisor portal
    return NextResponse.redirect(`${origin}/advisor`)
  }

  // New consumers — no household row means profile setup is incomplete
  // Route to /profile so they complete their household before hitting dashboard
  if (profile?.role === 'consumer') {
    const { data: household } = await supabase
      .from('households')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle()
    if (!household) {
      return NextResponse.redirect(`${origin}/profile`)
    }
  }

  // Returning users — honor next param, fall back to /dashboard
  return NextResponse.redirect(`${origin}${next}`)
}
