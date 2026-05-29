import { NextResponse } from 'next/server'
import { resend } from '@/lib/resend'
import { assertAppUrl, escapeHtml } from '@/lib/api/escapeHtml'
import { requireInternalApi } from '@/lib/api/internalApiAuth'

export async function POST(req: Request) {
  const denied = requireInternalApi(req)
  if (denied) return denied

  try {
    const { email, attorneyName, consumerName, signupUrl } = await req.json()

    if (!email || !signupUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const safeSignupUrl = assertAppUrl(String(signupUrl))
    if (!safeSignupUrl) {
      return NextResponse.json({ error: 'Invalid signup URL' }, { status: 400 })
    }

    const safeAttorney = escapeHtml(String(attorneyName ?? 'there'))
    const safeConsumer = escapeHtml(String(consumerName ?? 'A client'))

    const { error: emailError } = await resend.emails.send({
      from: 'MyWealthMaps <hello@mywealthmaps.com>',
      to: email,
      bcc: 'avoels@comcast.net',
      subject: `${safeConsumer} has requested your review on MyWealthMaps`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
          <h1 style="color:#1a1a2e;font-size:24px">MyWealthMap</h1>
          <p style="color:#6b7280;font-size:14px">Financial, Retirement &amp; Estate Planning in One Place</p>
          <div style="background:#f9fafb;border-radius:8px;padding:32px;margin:24px 0">
            <h2 style="color:#1a1a2e;font-size:20px;margin-top:0">You have been invited to review an estate plan</h2>
            <p style="color:#374151;font-size:16px;line-height:1.6">Hello ${safeAttorney},</p>
            <p style="color:#374151;font-size:16px;line-height:1.6">
              <strong>${safeConsumer}</strong> has selected you as their attorney on MyWealthMaps and is requesting your review of their estate plan.
            </p>
            <div style="text-align:center;margin:32px 0">
              <a href="${safeSignupUrl}" style="background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">Create Your Attorney Account</a>
            </div>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center">Questions? Reply to this email and we will get back to you.</p>
        </div>
      `,
    })

    if (emailError) {
      console.error('Attorney invite email error:', emailError)
      return NextResponse.json({ error: 'Failed to send attorney invite email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Attorney invite route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
