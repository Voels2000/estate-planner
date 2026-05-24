import { resend } from '@/lib/resend'
import { BILLING_DISCLOSURES } from '@/lib/compliance/billing-disclosures'

export async function sendRenewalReminderEmail(
  to: string,
  planName: string,
  price: string,
  renewalDate: string,
) {
  const body = BILLING_DISCLOSURES.renewalReminderEmail.body(planName, price, renewalDate)
  const { error } = await resend.emails.send({
    from: 'My Wealth Maps <hello@mywealthmaps.com>',
    to,
    subject: BILLING_DISCLOSURES.renewalReminderEmail.subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
        <h1 style="color:#1a1a2e;font-size:20px">Subscription renewal reminder</h1>
        <p style="color:#374151;font-size:16px;line-height:1.6">${body}</p>
        <p style="margin-top:24px">
          <a href="https://mywealthmaps.com/billing" style="color:#2563eb">Manage billing</a>
        </p>
      </div>
    `,
  })
  if (error) throw error
}
