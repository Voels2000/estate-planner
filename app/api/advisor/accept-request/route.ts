import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { resend } from '@/lib/resend'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, isSuperuser, isAdvisor } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperuser && !isAdvisor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile || (!isSuperuser && profile.role !== 'advisor')) {
    return NextResponse.json({ error: 'Advisor access required' }, { status: 403 })
  }

  const { advisor_client_id } = await request.json()
  if (!advisor_client_id) {
    return NextResponse.json({ error: 'advisor_client_id is required' }, { status: 400 })
  }

  // Fetch the request row — must belong to this advisor and be consumer_requested
  const { data: row, error: fetchError } = await admin
    .from('advisor_clients')
    .select('id, client_id, status')
    .eq('id', advisor_client_id)
    .eq('advisor_id', user.id)
    .eq('status', 'consumer_requested')
    .single()

  if (fetchError || !row) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  // Check advisor tier client limit before accepting
  const { data: currentClients } = await admin
    .from('advisor_clients')
    .select('id')
    .eq('advisor_id', user.id)
    .eq('status', 'active')

  const { data: advisorProfile } = await admin
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single()

  // Tier limits — same as invite flow
  const tierLimits: Record<string, number> = {
    advisor_starter: 10,
    advisor_pro: 50,
    advisor_enterprise: 9999,
  }
  const tierName = advisorProfile?.subscription_status ?? 'advisor_starter'
  const maxClients = tierLimits[tierName] ?? 10
  const currentCount = currentClients?.length ?? 0

  if (currentCount >= maxClients) {
    return NextResponse.json({
      error: 'tier_limit_reached',
      current_count: currentCount,
      max_clients: maxClients,
      tier_name: tierName,
    }, { status: 403 })
  }

  // Fetch consumer profile for notification email
  const { data: consumer } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', row.client_id)
    .single()

  if (!consumer?.email) {
    return NextResponse.json({ error: 'Consumer profile not found' }, { status: 404 })
  }

  // Directly activate — no second confirmation step required (Sprint 55 architectural change)
  // Advisor gets immediate read-only access to estate documents and strategy output
  const { error: updateError } = await admin
    .from('advisor_clients')
    .update({
      status: 'active',
      accepted_at: new Date().toISOString(),
      // Clear any stale invite token fields
      invite_token: null,
      invite_expires_at: null,
    })
    .eq('id', row.id)

  if (updateError) {
    console.error('Update error:', updateError)
    return NextResponse.json({ error: 'Failed to accept request' }, { status: 500 })
  }

  // Notify consumer that advisor accepted — no action required from consumer
  const advisorLabel = profile.full_name?.trim() || profile.email || 'Your advisor'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    await resend.emails.send({
      from: 'MyWealthMaps <noreply@mywealthmaps.com>',
      headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
      tags: [{ name: 'category', value: 'advisor_accept' }],
      to: consumer.email,
      subject: `${advisorLabel} accepted your connection request`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
          <h1 style="color:#1a1a2e;font-size:24px">MyWealthMaps</h1>
          <p style="color:#6b7280;font-size:14px">Financial, Retirement &amp; Estate Planning in One Place</p>
          <div style="background:#f9fafb;border-radius:8px;padding:32px;margin:24px 0">
            <h2 style="color:#1a1a2e;font-size:20px;margin-top:0">You're now connected</h2>
            <p style="color:#374151;font-size:16px;line-height:1.6">
              <strong>${advisorLabel}</strong> has accepted your connection request.
              They now have read-only access to your estate documents and strategy to help you plan.
            </p>
            <div style="text-align:center;margin:32px 0">
              <a href="${appUrl}/dashboard" style="background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">
                View My Dashboard
              </a>
            </div>
            <p style="color:#6b7280;font-size:14px">
              You can manage advisor access at any time in your account settings.
            </p>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center">
            MyWealthMaps · Estate Planning Platform
          </p>
        </div>
      `,
    })
  } catch (err) {
    // Non-fatal — connection is active, email is best-effort
    console.error('Notification email error:', err)
  }

  if (isSuperuser) {
    await admin.from('superuser_action_log').insert({
      user_id: user.id,
      endpoint: '/api/advisor/accept-request',
      target_id: advisor_client_id,
      action: 'accept-request',
    })
  }

  return NextResponse.json({ success: true })
}
