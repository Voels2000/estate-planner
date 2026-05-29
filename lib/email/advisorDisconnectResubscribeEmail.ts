import { resend } from '@/lib/resend'

type Params = {
  to: string
  firstName: string
  needsResubscribe: boolean
  billingUrl: string
  dashboardUrl: string
}

export async function sendAdvisorDisconnectResubscribeEmail({
  to,
  firstName,
  needsResubscribe,
  billingUrl,
  dashboardUrl,
}: Params) {
  const subject = needsResubscribe
    ? 'Your advisor connection ended — keep Estate access'
    : 'Your advisor connection on My Wealth Maps has ended'

  const ctaLabel = needsResubscribe ? 'View Estate plans' : 'Go to dashboard'
  const ctaUrl = needsResubscribe ? billingUrl : dashboardUrl

  const bodyCopy = needsResubscribe
    ? 'Your advisor-managed Estate access has ended. To keep Estate planning features, choose a plan that fits your needs.'
    : 'Your advisor connection has ended. You can continue using My Wealth Maps with your updated account access.'

  const { error } = await resend.emails.send({
    from: 'MyWealthMaps <noreply@mywealthmaps.com>',
    headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
    tags: [{ name: 'category', value: 'advisor_disconnect' }],
    to,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
        <h1 style="color:#1a1a2e;font-size:24px">MyWealthMaps</h1>
        <p style="color:#374151;font-size:16px;line-height:1.6">Hi ${firstName},</p>
        <p style="color:#374151;font-size:16px;line-height:1.6">${bodyCopy}</p>
        <div style="text-align:center;margin:32px 0">
          <a href="${ctaUrl}" style="background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">${ctaLabel}</a>
        </div>
        <p style="color:#6b7280;font-size:14px">You can manage advisor access anytime from My Advisor in your dashboard.</p>
      </div>
    `,
  })

  if (error) throw error
}
