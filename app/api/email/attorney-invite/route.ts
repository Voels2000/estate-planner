import { NextResponse } from 'next/server'
import { resend } from '@/lib/resend'

export async function POST(req: Request) {
  try {
    const { email, attorneyName, consumerName, signupUrl } = await req.json()

    if (!email || !signupUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { error: emailError } = await resend.emails.send({
      from: 'MyWealthMaps <hello@mywealthmaps.com>',
      to: email,
      bcc: 'avoels@comcast.net',
      subject: `${consumerName} has requested your review on MyWealthMaps`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
          <h1 style="color:#1a1a2e;font-size:24px">MyWealthMap</h1>
          <p style="color:#6b7280;font-size:14px">Financial, Retirement &amp; Estate Planning in One Place</p>
          <div style="background:#f9fafb;border-radius:8px;padding:32px;margin:24px 0">
            <h2 style="color:#1a1a2e;font-size:20px;margin-top:0">You have been invited to review an estate plan</h2>
            <p style="color:#374151;font-size:16px;line-height:1.6">
              Hello ${attorneyName || 'there'},
            </p>
            <p style="color:#374151;font-size:16px;line-height:1.6">
              <strong>${consumerName}</strong> has selected you as their attorney on MyWealthMaps and is requesting your review of their estate plan.
            </p>
            <p style="color:#374151;font-size:16px;line-height:1.6">
              To get started, create your free attorney account. You will not be charged — attorney access to the platform is complimentary.
            </p>
            <div style="text-align:center;margin:32px 0">
              <a href="${signupUrl}" style="background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">Create Your Attorney Account</a>
            </div>
            <p style="color:#6b7280;font-size:14px;line-height:1.6">
              Once your account is set up and ${consumerName} approves your access, you will be able to review their estate plan, upload documents, and communicate securely through the platform.
            </p>
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:16px;margin-top:24px">
              <p style="color:#1e40af;font-size:13px;margin:0;line-height:1.6">
                <strong>Your access is controlled by the client.</strong> You will only see data they explicitly share with you, and they can revoke access at any time.
              </p>
            </div>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center">Questions? Reply to this email and we will get back to you.</p>
        </div>
      `
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
