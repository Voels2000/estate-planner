import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resend } from '@/lib/resend'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const {
      attorneyId,
      attorneyEmail,
      attorneyFirmName,
      attorneyContactName,
      userName,
      userEmail,
      note,
    } = await req.json()

    if (!attorneyId || !attorneyEmail || !userEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const attorneyName = attorneyContactName ?? attorneyFirmName

    await resend.emails.send({
      from: 'hello@mywealthmaps.com',
      to: attorneyEmail,
      subject: `New Referral Request — ${userName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #111; margin-bottom: 8px;">New Referral Request</h2>
          <p style="color: #555;">Hi ${attorneyName},</p>
          <p style="color: #555;">A consumer on <strong>My Wealth Maps</strong> has requested a referral to your practice.</p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0 0 8px; color: #111;"><strong>Name:</strong> ${userName}</p>
            <p style="margin: 0 0 8px; color: #111;"><strong>Email:</strong> ${userEmail}</p>
            ${note ? `<p style="margin: 0; color: #111;"><strong>Note:</strong> ${note}</p>` : ''}
          </div>
          <p style="color: #555;">Please reach out to them directly at your earliest convenience.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
          <p style="color: #aaa; font-size: 12px;">This referral was sent via My Wealth Maps · mywealthmaps.com</p>
        </div>
      `,
    })

    await resend.emails.send({
      from: 'hello@mywealthmaps.com',
      to: userEmail,
      subject: `Your referral to ${attorneyFirmName} has been sent`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #111; margin-bottom: 8px;">Referral Sent</h2>
          <p style="color: #555;">Hi ${userName},</p>
          <p style="color: #555;">We've sent your referral request to <strong>${attorneyFirmName}</strong>. They will reach out to you directly at <strong>${userEmail}</strong>.</p>
          ${note ? `<div style="background: #f5f5f5; border-radius: 8px; padding:16px; margin: 24px 0;"><p style="margin: 0; color: #555;"><strong>Your note:</strong> ${note}</p></div>` : ''}
          <p style="color: #555;">In the meantime, keep building your estate plan on My Wealth Maps.</p>
          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard" style="display: inline-block; margin-top: 16px; background: #111; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px;">
            Return to Dashboard
          </a>
          <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
          <p style="color: #aaa; font-size: 12px;">My Wealth Maps · mywealthmaps.com</p>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Attorney referral email error:', error)
    return NextResponse.json({ error: 'Failed to send referral' }, { status: 500 })
  }
}
