import { NextResponse } from 'next/server'
import { resend } from '@/lib/resend'

export async function POST(req: Request) {
  console.log('NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL)
  console.log('NEXT_PUBLIC_SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL)
  try {
    const { email, attorneyName, consumerName } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 })
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
            <h2 style="color:#1a1a2e;font-size:20px;margin-top:0">A client has requested your review</h2>
            <p style="color:#374151;font-size:16px;line-height:1.6">
              Hello ${attorneyName || 'there'},
            </p>
            <p style="color:#374151;font-size:16px;line-height:1.6">
              <strong>${consumerName}</strong> has selected you as their attorney on MyWealthMaps and is requesting your review of their estate plan.
            </p>
            <p style="color:#374151;font-size:16px;line-height:1.6">
              Log in to your attorney portal to review and respond to this request.
            </p>
            <div style="text-align:center;margin:32px 0">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/login" style="background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">Log In to Attorney Portal</a>
              <p style="color:#6b7280;font-size:13px;margin-top:12px">
                After signing in, your pending client request will be waiting on your 
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/attorney/dashboard" style="color:#2563eb;text-decoration:none">attorney dashboard</a>.
              </p>
            </div>
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:16px;margin-top:24px">
              <p style="color:#1e40af;font-size:13px;margin:0;line-height:1.6">
                <strong>Security reminder:</strong> We will never send a link that logs you in automatically. Always log in through the standard sign-in page to protect your clients&#39; data.
              </p>
            </div>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center">Questions? Reply to this email and we will get back to you.</p>
        </div>
      `
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
