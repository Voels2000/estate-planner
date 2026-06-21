import { resend } from '@/lib/resend'
import { EMAIL_FROM } from '@/lib/email/config'

export async function sendPostDeployFailureEmail(params: {
  to: string
  failedChecks: { name: string; detail?: string }[]
}) {
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const lines = [
    'My Wealth Maps — Post-deploy verify FAILED',
    dateStr,
    '',
    `Failed checks (${params.failedChecks.length}):`,
    ...params.failedChecks.map(
      (c) => `- ${c.name}${c.detail ? `: ${c.detail}` : ''}`,
    ),
    '',
    'Action: npm run verify:post-deploy-voels or npm run smoke:mc-voels',
    'Admin: https://www.mywealthmaps.com/admin → Ops Home → Cron Health',
  ]

  const text = lines.join('\n')
  const subject = `⚠️ Post-deploy verify failed — My Wealth Maps ${dateStr}`

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: params.to,
    subject,
    text,
    html: `<pre style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap">${text.replace(/</g, '&lt;')}</pre>`,
  })

  if (error) throw error
}
