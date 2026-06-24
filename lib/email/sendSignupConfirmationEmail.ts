import { escapeHtml } from '@/lib/api/escapeHtml'
import { EMAIL_FROM } from '@/lib/email/config'
import { resend } from '@/lib/resend'

export async function sendSignupConfirmationEmail(opts: {
  to: string
  confirmUrl: string
  name?: string
}): Promise<void> {
  const { to, confirmUrl, name } = opts
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,'
  const safeUrlText = escapeHtml(confirmUrl)

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: 'Confirm your email to start your My Wealth Maps estate plan',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
        <h1 style="color:#1f3a5f;font-size:22px;margin:0 0 24px">My Wealth Maps</h1>
        <p style="color:#1a1a1a;font-size:15px;line-height:24px">${greeting}</p>
        <p style="color:#1a1a1a;font-size:15px;line-height:24px">
          Thanks for creating your My Wealth Maps account — the estate planning workspace for
          organizing your assets, modeling your plan, and working with your advisor and attorney
          in one place.
        </p>
        <p style="color:#1a1a1a;font-size:15px;line-height:24px">
          Confirm your email to activate your account:
        </p>
        <div style="text-align:center;margin:32px 0">
          <a href="${confirmUrl}" style="background:#1f3a5f;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold;display:inline-block">Confirm my email</a>
        </div>
        <p style="color:#6b7280;font-size:13px;line-height:20px">
          If the button doesn&apos;t work, paste this link into your browser:
        </p>
        <p style="color:#1f3a5f;font-size:13px;word-break:break-all">${safeUrlText}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#6b7280;font-size:12px;line-height:18px">
          You&apos;re receiving this because this address was used to sign up for My Wealth Maps.
          If that wasn&apos;t you, ignore this email — no account will be activated.
        </p>
      </div>
    `,
  })

  if (error) {
    throw new Error(`Resend signup confirmation failed: ${error.message}`)
  }
}
