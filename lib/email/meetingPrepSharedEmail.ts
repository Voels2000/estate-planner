import { resend } from '@/lib/resend'

type Params = {
  to: string
  clientFirstName: string
  advisorName: string
  dashboardUrl: string
  healthScore?: number | null
  grossEstateLabel?: string | null
  personalMessage?: string | null
}

export async function sendMeetingPrepSharedEmail({
  to,
  clientFirstName,
  advisorName,
  dashboardUrl,
  healthScore,
  grossEstateLabel,
  personalMessage,
}: Params) {
  const summaryLines = [
    healthScore != null ? `<li>Estate readiness score: <strong>${healthScore}/100</strong></li>` : '',
    grossEstateLabel ? `<li>Projected gross estate: <strong>${grossEstateLabel}</strong></li>` : '',
  ]
    .filter(Boolean)
    .join('')

  const { error } = await resend.emails.send({
    from: 'MyWealthMaps <noreply@mywealthmaps.com>',
    headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
    tags: [{ name: 'category', value: 'meeting_prep_shared' }],
    to,
    subject: `${advisorName} shared a planning brief with you`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
        <h1 style="color:#1a1a2e;font-size:24px">MyWealthMaps</h1>
        <p style="color:#374151;font-size:16px;line-height:1.6">Hi ${clientFirstName},</p>
        <p style="color:#374151;font-size:16px;line-height:1.6">
          <strong>${advisorName}</strong> prepared a meeting brief from your plan on My Wealth Maps.
        </p>
        ${personalMessage ? `<p style="color:#374151;font-size:15px;font-style:italic">"${personalMessage}"</p>` : ''}
        ${summaryLines ? `<ul style="color:#374151;font-size:15px;line-height:1.8">${summaryLines}</ul>` : ''}
        <div style="text-align:center;margin:32px 0">
          <a href="${dashboardUrl}" style="background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">View my dashboard</a>
        </div>
        <p style="color:#6b7280;font-size:14px">Sign in to review your plan, advisor recommendations, and next steps with your advisor.</p>
      </div>
    `,
  })

  if (error) throw error
}
