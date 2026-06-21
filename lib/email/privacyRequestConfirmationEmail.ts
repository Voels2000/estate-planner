import { resend } from '@/lib/resend'
import { EMAIL_FROM } from '@/lib/email/config'

const REQUEST_LABELS: Record<string, string> = {
  deletion: 'data deletion',
  access: 'data access',
  correction: 'data correction',
  portability: 'data portability',
  opt_out: 'opt-out of sale',
}

export async function sendPrivacyRequestConfirmationEmail(params: {
  to: string
  requestType: string
  requestId: string
  dueAt: string
}) {
  const { to, requestType, requestId, dueAt } = params
  const label = REQUEST_LABELS[requestType] ?? requestType
  const dueFormatted = new Date(dueAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: 'We received your privacy request — My Wealth Maps',
    text: `My Wealth Maps — Privacy Request Confirmation

We received your ${label} request.

Reference ID: ${requestId}
We will respond within 45 days (by ${dueFormatted}).

If you did not submit this request, contact us at privacy@mywealthmaps.com.

— My Wealth Maps`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
        <h1 style="color:#1a1a2e;font-size:20px">Privacy request received</h1>
        <p style="color:#374151;font-size:16px;line-height:1.6">
          We received your <strong>${label}</strong> request.
        </p>
        <p style="color:#374151;font-size:16px;line-height:1.6">
          <strong>Reference ID:</strong> <code style="font-family:monospace">${requestId}</code><br>
          <strong>Response by:</strong> ${dueFormatted} (45 days per our Privacy Policy)
        </p>
        <p style="color:#6b7280;font-size:14px;line-height:1.6">
          If you did not submit this request, contact
          <a href="mailto:privacy@mywealthmaps.com">privacy@mywealthmaps.com</a>.
        </p>
      </div>
    `,
  })

  if (error) throw error
}
