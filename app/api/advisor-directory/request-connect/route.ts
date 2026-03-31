import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const resend = new Resend(process.env.RESEND_API_KEY)

  // 1. Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Consumer role check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'consumer') {
    return NextResponse.json({ error: 'Consumer access required' }, { status: 403 })
  }

  // 3. Parse body
  const { listing_id, message } = await request.json()
  if (!listing_id || !message?.trim()) {
    return NextResponse.json({ error: 'listing_id and message are required' }, { status: 400 })
  }

  // 4. Fetch the advisor listing
  const { data: listing } = await admin
    .from('advisor_directory')
    .select('id, firm_name, email, profile_id')
    .eq('id', listing_id)
    .eq('is_active', true)
    .single()

  if (!listing) {
    return NextResponse.json({ error: 'Advisor listing not found' }, { status: 404 })
  }

  // 5. Duplicate check
  const { data: existing } = await admin
    .from('connection_requests')
    .select('id')
    .eq('listing_id', listing_id)
    .eq('consumer_id', user.id)
    .eq('listing_type', 'advisor')
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'You already have a pending request with this advisor' },
      { status: 409 }
    )
  }

  // 6. Insert connection request
  const { error: insertError } = await admin
    .from('connection_requests')
    .insert({
      listing_type: 'advisor',
      listing_id,
      profile_id: listing.profile_id ?? null,
      consumer_id: user.id,
      message: message.trim(),
      status: 'pending',
    })

  if (insertError) {
    console.error('Insert error:', insertError)
    return NextResponse.json({ error: 'Failed to send request' }, { status: 500 })
  }

  // 7. Fire email + notifications (fire-and-forget)
  const consumerLabel = profile.full_name?.trim() || profile.email || 'A potential client'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mywealthmaps.com'

  ;(async () => {
    try {
      // Email to listing email address
      await resend.emails.send({
        from: 'MyWealthMaps <hello@mywealthmaps.com>',
        to: listing.email,
        bcc: 'avoels@comcast.net',
        subject: `New connection request from ${consumerLabel}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
            <h1 style="color:#1a1a2e;font-size:24px">MyWealthMaps</h1>
            <p style="color:#6b7280;font-size:14px">Financial, Retirement &amp; Estate Planning in One Place</p>
            <div style="background:#f9fafb;border-radius:8px;padding:32px;margin:24px 0">
              <h2 style="color:#1a1a2e;font-size:20px;margin-top:0">New Connection Request</h2>
              <p style="color:#374151;font-size:16px;line-height:1.6">
                <strong>${consumerLabel}</strong> has requested to connect with <strong>${listing.firm_name}</strong> on MyWealthMaps.
              </p>
              <div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:16px 0">
                <p style="color:#374151;font-size:14px;font-style:italic;margin:0">"${message.trim()}"</p>
              </div>
              <div style="text-align:center;margin:32px 0">
                <a href="${appUrl}/advisor" style="background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">
                  Claim Your Listing &amp; Respond
                </a>
              </div>
              <p style="color:#6b7280;font-size:14px;text-align:center">
                Log in or create your advisor account to manage connection requests.
              </p>
            </div>
            <p style="color:#9ca3af;font-size:12px;text-align:center">
              This request was sent via MyWealthMaps. If you did not expect this, you can safely ignore it.
            </p>
          </div>
        `,
      })

      // If listing has a claimed profile — also send in-app notification
      if (listing.profile_id) {
        await admin.rpc('create_notification', {
          p_user_id: listing.profile_id,
          p_type: 'consumer_connection_request',
          p_title: 'New connection request',
          p_body: `${consumerLabel} has requested to connect with you. Check your email to respond.`,
          p_delivery: 'in_app',
          p_metadata: { listing_id, consumer_id: user.id },
          p_cooldown: '1 hour',
        })
      }

      // Confirm to consumer in-app
      await admin.rpc('create_notification', {
        p_user_id: user.id,
        p_type: 'consumer_connection_request_sent',
        p_title: 'Connection request sent',
        p_body: `Your request has been sent to ${listing.firm_name}. They will be in touch if they want to connect.`,
        p_delivery: 'in_app',
        p_metadata: { listing_id },
        p_cooldown: '1 hour',
      })
    } catch (err) {
      console.error('Notification/email error:', err)
    }
  })()

  return NextResponse.json({ success: true })
}
