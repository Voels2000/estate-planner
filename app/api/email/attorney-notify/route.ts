import { NextResponse } from 'next/server'
import { resend } from '@/lib/resend'
import { escapeHtml } from '@/lib/api/escapeHtml'
import { requireInternalApi } from '@/lib/api/internalApiAuth'

export async function POST(req: Request) {
  const denied = requireInternalApi(req)
  if (denied) return denied

  try {
    const { email, attorneyName, consumerName } = await req.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 })
    }

    const safeAttorney = escapeHtml(String(attorneyName ?? 'there'))
    const safeConsumer = escapeHtml(String(consumerName ?? 'A client'))

    const { error: emailError } = await resend.emails.send({
      from: 'MyWealthMaps <hello@mywealthmaps.com>',
      to: email,
      bcc: 'avoels@comcast.net',
      subject: `${String(consumerName ?? 'A client')} has requested your review on MyWealthMaps`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
          <h1 style="color:#1a1a2e;font-size:24px">MyWealthMap</h1>
          <p style="color:#6b7280;font-size:14px">Financial, Retirement &amp; Estate Planning in One Place</p>
          <div style="background:#f9fafb;border-radius:8px;padding:32px;margin:24px 0">
            <h2 style="color:#1a1a2e;font-size:20px;margin-top:0">A client has requested your review</h2>
            <p style="color:#374151;font-size:16px;line-height:1.6">Hello ${safeAttorney},</p>
            <p style="color:#374151;font-size:16px;line-height:1.6">
              <strong>${safeConsumer}</strong> has selected you as their attorney on MyWealthMaps and is requesting your review of their estate plan.
            </p>
            <p style="color:#374151;font-size:16px;line-height:1.6">
              Log in to your attorney portal to review and respond to this request.
            </p>
            <div style="text-align:center;margin:32px 0">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/login" style="background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">Log In to Attorney Portal</a>
            </div>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center">Questions? Reply to this email and we will get back to you.</p>
        </div>
      `,
    })

    if (emailError) {
      console.error('Attorney notify email error:', emailError)
      return NextResponse.json({ error: 'Failed to send attorney notification email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Attorney notify route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
