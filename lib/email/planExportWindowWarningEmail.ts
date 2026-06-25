import { resend } from '@/lib/resend'
import { BILLING_DISCLOSURES } from '@/lib/compliance/billing-disclosures'
import { EMAIL_FROM } from '@/lib/email/config'

export type PlanExportWindowWarningEmailInput = {
  to: string
  daysRemaining: 14 | 3
  lockDateIso: string
}

export async function sendPlanExportWindowWarningEmail(
  input: PlanExportWindowWarningEmailInput,
) {
  const lockDate = new Date(input.lockDateIso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })

  const copy = BILLING_DISCLOSURES.planExportWindowWarningEmail(
    input.daysRemaining,
    lockDate,
  )

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: input.to,
    subject: copy.subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
        <h1 style="color:#1a1a2e;font-size:20px">Plan &amp; Export editing window</h1>
        <p style="color:#374151;font-size:16px;line-height:1.6">${copy.body}</p>
        <p style="margin-top:24px">
          <a href="https://mywealthmaps.com/billing" style="color:#2563eb">View subscription options</a>
        </p>
      </div>
    `,
  })
  if (error) throw error
}
