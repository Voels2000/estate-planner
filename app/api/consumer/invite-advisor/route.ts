import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resend } from '@/lib/resend'
import { getAppUrl } from '@/lib/app-url'
import { generateInviteToken, tokenExpiresAt } from '@/lib/invite-token'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'

export const dynamic = 'force-dynamic'

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'consumer') {
    return NextResponse.json({ error: 'Consumer access required' }, { status: 403 })
  }

  const body = (await request.json()) as {
    advisorEmail?: string
    message?: string
    completeOnboarding?: boolean
  }

  const advisorEmail = normalizeEmail(body.advisorEmail ?? '')
  if (!advisorEmail || !advisorEmail.includes('@')) {
    return NextResponse.json({ error: 'A valid advisor email is required' }, { status: 400 })
  }

  if (advisorEmail === normalizeEmail(profile.email ?? user.email ?? '')) {
    return NextResponse.json({ error: 'You cannot invite yourself' }, { status: 400 })
  }

  const { data: existingConnection } = await admin
    .from('advisor_clients')
    .select('id')
    .eq('client_id', user.id)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES, 'consumer_requested', 'pending'])
    .maybeSingle()

  if (existingConnection) {
    return NextResponse.json(
      { error: 'You already have a pending or active advisor connection' },
      { status: 409 },
    )
  }

  const { data: advisorProfile } = await admin
    .from('profiles')
    .select('id, full_name, email, role')
    .ilike('email', advisorEmail)
    .maybeSingle()

  const isRegisteredAdvisor =
    advisorProfile?.role === 'advisor' || advisorProfile?.role === 'financial_advisor'

  const connectToken = generateInviteToken()
  const expiresAt = tokenExpiresAt()
  const requestMessage = body.message?.trim() || null
  const consumerLabel = profile.full_name?.trim() || profile.email || 'A client'
  const appUrl = getAppUrl()

  if (isRegisteredAdvisor && advisorProfile) {
    const { data: duplicate } = await admin
      .from('advisor_clients')
      .select('id')
      .eq('advisor_id', advisorProfile.id)
      .eq('client_id', user.id)
      .neq('status', 'removed')
      .maybeSingle()

    if (duplicate) {
      return NextResponse.json(
        { error: 'You already have a connection request with this advisor' },
        { status: 409 },
      )
    }

    const { error: insertError } = await admin.from('advisor_clients').insert({
      advisor_id: advisorProfile.id,
      client_id: user.id,
      status: 'consumer_requested',
      request_message: requestMessage,
      invited_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error('consumer invite-advisor insert:', insertError)
      return NextResponse.json({ error: 'Failed to create connection request' }, { status: 500 })
    }

    try {
      await resend.emails.send({
        from: 'MyWealthMaps <noreply@mywealthmaps.com>',
        headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
        tags: [{ name: 'category', value: 'consumer_invite_advisor' }],
        to: advisorEmail,
        subject: `${consumerLabel} invited you to connect on My Wealth Maps`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
            <h1 style="color:#1a1a2e;font-size:24px">MyWealthMaps</h1>
            <p style="color:#374151;font-size:16px;line-height:1.6">
              <strong>${consumerLabel}</strong> would like to connect with you on My Wealth Maps.
            </p>
            ${requestMessage ? `<p style="color:#374151;font-size:15px;font-style:italic">"${requestMessage}"</p>` : ''}
            <div style="text-align:center;margin:32px 0">
              <a href="${appUrl}/advisor" style="background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">
                Review Connection Request
              </a>
            </div>
          </div>
        `,
      })
    } catch (err) {
      console.error('consumer invite-advisor email (existing advisor):', err)
    }

    try {
      await admin.rpc('create_notification', {
        p_user_id: advisorProfile.id,
        p_type: 'consumer_connection_request',
        p_title: 'New client connection request',
        p_body: `${consumerLabel} would like to connect with you on My Wealth Maps.`,
        p_delivery: 'both',
        p_metadata: { consumer_id: user.id },
        p_cooldown: '1 hour',
      })
    } catch {}
  } else {
    const { error: insertError } = await admin.from('advisor_clients').insert({
      client_id: user.id,
      invited_email: advisorEmail,
      status: 'consumer_requested',
      request_message: requestMessage,
      invite_token: connectToken,
      invite_expires_at: expiresAt.toISOString(),
      invited_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error('consumer invite-advisor pre-register insert:', insertError)
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
    }

    const signupUrl = `${appUrl}/signup?role=advisor&connect=${connectToken}&email=${encodeURIComponent(advisorEmail)}`

    try {
      await resend.emails.send({
        from: 'MyWealthMaps <noreply@mywealthmaps.com>',
        headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
        tags: [{ name: 'category', value: 'consumer_invite_advisor_signup' }],
        to: advisorEmail,
        subject: `${consumerLabel} invited you to My Wealth Maps`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
            <h1 style="color:#1a1a2e;font-size:24px">MyWealthMaps</h1>
            <p style="color:#374151;font-size:16px;line-height:1.6">
              <strong>${consumerLabel}</strong> uses My Wealth Maps and invited you to connect as their advisor.
            </p>
            ${requestMessage ? `<p style="color:#374151;font-size:15px;font-style:italic">"${requestMessage}"</p>` : ''}
            <div style="text-align:center;margin:32px 0">
              <a href="${signupUrl}" style="background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">
                Create Advisor Account
              </a>
            </div>
            <p style="color:#6b7280;font-size:14px;text-align:center">This invitation expires in 7 days.</p>
          </div>
        `,
      })
    } catch (err) {
      console.error('consumer invite-advisor email (new advisor):', err)
      return NextResponse.json({ error: 'Invitation created but email failed to send' }, { status: 500 })
    }
  }

  if (body.completeOnboarding) {
    await supabase
      .from('profiles')
      .update({
        onboarding_invite_advisor_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
  }

  return NextResponse.json({
    success: true,
    message: `Invitation sent to ${advisorEmail}`,
  })
}
