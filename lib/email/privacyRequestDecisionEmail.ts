import { resend } from '@/lib/resend'
import { EMAIL_FROM } from '@/lib/email/config'

export async function sendPrivacyRequestDecisionEmail(params: {
  to: string
  requestId: string
  requestType: string
  denied: boolean
  reason?: string
}) {
  const { to, requestId, denied, reason } = params

  const subject = denied
    ? 'Update on your privacy request — My Wealth Maps'
    : 'Your privacy request is complete — My Wealth Maps'

  const appealBlock = denied
    ? `

If you disagree with this decision, you may appeal by replying to this email or contacting privacy@mywealthmaps.com with reference ID ${requestId}. We will respond to your appeal in writing within 60 days. If we deny your appeal, we will explain the reason and provide information on how to contact your state Attorney General or other applicable regulator.`
    : ''

  const reasonBlock = denied && reason?.trim() ? `\n\nReason: ${reason.trim()}` : ''

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    text: `My Wealth Maps — Privacy Request Update

Reference ID: ${requestId}

${
  denied
    ? `We are unable to fulfill your privacy request as submitted.${reasonBlock}${appealBlock}`
    : 'Your privacy request has been completed.'
}

— My Wealth Maps`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
        <h1 style="color:#1a1a2e;font-size:20px">Privacy request update</h1>
        <p style="color:#374151;font-size:16px;line-height:1.6">
          <strong>Reference ID:</strong> <code style="font-family:monospace">${requestId}</code>
        </p>
        <p style="color:#374151;font-size:16px;line-height:1.6">
          ${
            denied
              ? `We are unable to fulfill your privacy request as submitted.${
                  reason?.trim()
                    ? `<br><br><strong>Reason:</strong> ${reason.trim()}`
                    : ''
                }`
              : 'Your privacy request has been completed.'
          }
        </p>
        ${
          denied
            ? `<p style="color:#374151;font-size:16px;line-height:1.6">
                If you disagree with this decision, you may appeal by replying to this email or contacting
                <a href="mailto:privacy@mywealthmaps.com">privacy@mywealthmaps.com</a>
                with your reference ID. We will respond to your appeal in writing within 60 days.
              </p>`
            : ''
        }
      </div>
    `,
  })

  if (error) throw error
}
