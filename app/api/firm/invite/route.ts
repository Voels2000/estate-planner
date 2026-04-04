import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { resend } from '@/lib/resend'
import { syncFirmStripeQuantity } from '@/lib/stripe/syncFirmQuantity'

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function POST(request: Request) {
  try {
    const ctx = await getAccessContext()
    if (!ctx.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!ctx.isAdvisor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!ctx.isFirmOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!ctx.firm_id) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const raw = body.email
    if (typeof raw !== 'string' || !raw.trim()) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }
    const email = normalizeEmail(raw)

    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: members } = await supabase
      .from('firm_members')
      .select('id, invited_email, user_id')
      .eq('firm_id', ctx.firm_id)
      .neq('status', 'removed')

    const invitedDup = members?.some(
      (m) => m.invited_email && normalizeEmail(m.invited_email) === email,
    )
    if (invitedDup) {
      return NextResponse.json(
        { error: 'This advisor is already a member or has a pending invite.' },
        { status: 409 },
      )
    }

    const { data: profileByEmail } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    const memberDup = profileByEmail
      ? members?.some((m) => m.user_id === profileByEmail.id)
      : false
    if (memberDup) {
      return NextResponse.json(
        { error: 'This advisor is already a member or has a pending invite.' },
        { status: 409 },
      )
    }

    const inviteToken = crypto.randomUUID()

    const { data: firmRowBefore } = await admin
      .from('firms')
      .select('seat_count')
      .eq('id', ctx.firm_id)
      .single()

    const { data: inserted, error: insertError } = await admin
      .from('firm_members')
      .insert({
        firm_id: ctx.firm_id,
        invited_email: email,
        firm_role: 'member',
        invited_by: ctx.user.id,
        invited_at: new Date().toISOString(),
        status: 'pending',
        invite_token: inviteToken,
        user_id: null,
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      console.error('firm invite insert:', insertError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const { error: seatError } = await admin
      .from('firms')
      .update({ seat_count: (firmRowBefore?.seat_count ?? 0) + 1 })
      .eq('id', ctx.firm_id)

    if (seatError) {
      console.error('firm invite seat_count:', seatError)
      await admin.from('firm_members').delete().eq('id', inserted.id)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const firmName = ctx.firm_name ?? 'Your firm'
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      'http://localhost:3000'
    const signupUrl = `${siteUrl}/signup?invite_token=${encodeURIComponent(inviteToken)}&firm_id=${encodeURIComponent(ctx.firm_id)}&role=advisor`

    const { error: emailError } = await resend.emails.send({
      from: 'MyWealthMaps <hello@mywealthmaps.com>',
      bcc: 'avoels@comcast.net',
      headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
      tags: [{ name: 'category', value: 'firm_advisor_invite' }],
      to: email,
      subject: "You've been invited to join a firm on MyWealthMaps",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px 16px">
          <p style="color:#374151;font-size:16px;line-height:1.6">${firmName} has invited you to join their advisory firm on MyWealthMaps.</p>
          <p style="color:#374151;font-size:16px;line-height:1.6">Click below to create your account and join the firm:</p>
          <p style="margin:24px 0"><a href="${signupUrl}" style="color:#2563eb;font-size:16px">${signupUrl}</a></p>
          <p style="color:#374151;font-size:16px;line-height:1.6">If you already have an account, log in and you will be joined to the firm automatically.</p>
          <p style="color:#374151;font-size:16px;line-height:1.6">Questions? Reply to this email.</p>
        </div>
      `,
    })

    if (emailError) {
      console.error('Resend error (firm invite):', emailError)
      await admin.from('firm_members').delete().eq('id', inserted.id)
      await admin
        .from('firms')
        .update({ seat_count: firmRowBefore?.seat_count ?? 1 })
        .eq('id', ctx.firm_id)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    await syncFirmStripeQuantity(ctx.firm_id)

    return NextResponse.json({
      success: true,
      message: 'Invite sent.',
    })
  } catch (err) {
    console.error('POST /api/firm/invite', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
