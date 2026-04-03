import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { resend } from '@/lib/resend'
import { generateInviteToken, tokenExpiresAt } from '@/lib/invite-token'


export async function POST(request: Request) {
  try {
    const { user, isSuperuser, isAdvisor } = await getAccessContext()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isSuperuser && !isAdvisor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const supabase = await createClient()

    const { invitedEmail } = await request.json()

    if (!invitedEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Get advisor profile
    const { data: advisor } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()

    if (!advisor || (!isSuperuser && advisor.role !== 'advisor' && advisor.role !== 'financial_advisor')) {
      return NextResponse.json({ error: 'Only advisors can send invites' }, { status: 403 })
    }

    // Check for existing pending invite
    const { data: existing } = await supabase
      .from('advisor_clients')
      .select('id, status')
      .eq('advisor_id', user.id)
      .eq('invited_email', invitedEmail)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'An invite is already pending for this email' }, { status: 409 })
    }

    // Generate token
    const token = generateInviteToken()
    const expiresAt = tokenExpiresAt()

    // Insert invite row
    const { error: insertError } = await supabase
      .from('advisor_clients')
      .insert({
        advisor_id: user.id,
        invited_email: invitedEmail,
        status: 'pending',
        invited_at: new Date().toISOString(),
        invite_token: token,
        invite_expires_at: expiresAt.toISOString()
      })

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
    }

    // Send email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const acceptUrl = `${appUrl}/invite/${token}`

    const { error: emailError } = await resend.emails.send({
      from: 'MyWealthMaps <noreply@mywealthmaps.com>'
,
      headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
      tags: [{ name: 'category', value: 'advisor_invite' }],
      to: invitedEmail,
      subject: `${advisor.full_name} has invited you to MyWealthMaps`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
          <h1 style="color:#1a1a2e;font-size:24px">MyWealthMap</h1>
          <p style="color:#6b7280;font-size:14px">Financial, Retirement &amp; Estate Planning in One Place</p>
          <div style="background:#f9fafb;border-radius:8px;padding:32px;margin:24px 0">
            <h2 style="color:#1a1a2e;font-size:20px;margin-top:0">You have been invited</h2>
            <p style="color:#374151;font-size:16px;line-height:1.6"><strong>${advisor.full_name}</strong> has invited you to join MyWealthMap.</p>
            <p style="color:#374151;font-size:16px;line-height:1.6">Your advisor will collaborate with you on your financial plan directly through the platform.</p>
            <div style="text-align:center;margin:32px 0">
              <a href="${acceptUrl}" style="background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">Accept Invitation</a>
            </div>
            <p style="color:#6b7280;font-size:14px;text-align:center">This invitation was sent to ${invitedEmail}. It expires in 7 days.</p>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center">If you did not expect this invitation, you can safely ignore this email.</p>
        </div>
      `
    })

    if (emailError) {
      console.error('Resend error:', emailError)
      return NextResponse.json({ error: 'Invite created but email failed to send' }, { status: 500 })
    }

    if (isSuperuser) {
      const admin = createAdminClient()
      await admin.from('superuser_action_log').insert({
        user_id: user.id,
        endpoint: '/api/advisor/invite',
        target_id: null,
        action: 'invite',
      })
    }

    return NextResponse.json({ success: true, message: `Invitation sent to ${invitedEmail}` })

  } catch (err) {
    console.error('Invite route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
