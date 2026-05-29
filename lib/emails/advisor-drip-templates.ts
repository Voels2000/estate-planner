import { getAppUrl } from '@/lib/app-url'

export type AdvisorDripEmail = {
  subject: string
  headline: string
  body: string
  cta: string
  ctaUrl: string
}

export type AdvisorDripSequence = {
  email1: AdvisorDripEmail
  email2: AdvisorDripEmail
  email3: AdvisorDripEmail
}

const appUrl = getAppUrl()

export const ADVISOR_DRIP_SEQUENCE: AdvisorDripSequence = {
  email1: {
    subject: 'Welcome to My Wealth Maps for advisors',
    headline: 'Your advisor portal is ready',
    body: 'Invite clients by email — they get free Estate access when connected. Review their health score, model strategies in the sandbox, send recommendations they accept in their dashboard, and export meeting prep briefs to share.',
    cta: 'Invite your first client',
    ctaUrl: `${appUrl}/advisor`,
  },
  email2: {
    subject: 'Still waiting on your first client?',
    headline: 'One invite unlocks the full workflow',
    body: 'Advisors who connect one client typically start with a client email invite, then review Overview gaps and send one strategy recommendation before the first meeting. Clients see value on their own dashboard — not just a PDF in their inbox.',
    cta: 'Add a client in the portal',
    ctaUrl: `${appUrl}/advisor`,
  },
  email3: {
    subject: 'How advisors use My Wealth Maps with clients',
    headline: 'Living dashboards beat static reports',
    body: 'Unlike traditional planning portals where clients only receive PDFs, My Wealth Maps gives your clients a living dashboard at Tier 3 while you retain read-only access to their plan. Use Meeting Prep to email a brief, Strategy to propose sandbox items clients promote to their plan, and life-event referral links to drive new prospects.',
    cta: 'Open advisor portal',
    ctaUrl: `${appUrl}/advisor`,
  },
}

export function buildAdvisorDripEmailHtml(params: {
  email: AdvisorDripEmail
  recipientEmail: string
  unsubscribeUrl: string
}): string {
  const { email, unsubscribeUrl } = params
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${email.subject}</title>
</head>
<body style="margin:0;padding:0;background:#fafaf8;font-family:DM Sans,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf8;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 20px rgba(15,31,61,0.08);">
          <tr>
            <td style="background:#0f1f3d;padding:24px 32px;">
              <span style="font-family:Georgia,serif;font-size:15px;font-weight:500;color:white;">My Wealth Maps · Advisor</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="font-family:Georgia,serif;font-size:22px;color:#0f1f3d;margin:0 0 16px;line-height:1.3;">
                ${email.headline}
              </h1>
              <p style="font-size:14px;color:#4a5568;line-height:1.7;margin:0 0 24px;">
                ${email.body}
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#0f1f3d;border-radius:8px;padding:12px 24px;">
                    <a href="${email.ctaUrl}" style="color:white;text-decoration:none;font-size:14px;font-weight:600;">
                      ${email.cta} →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;"></td>
          </tr>
          <tr>
            <td style="padding:20px 32px;">
              <p style="font-size:11px;color:#718096;margin:0;line-height:1.6;">
                You're receiving this because you have an advisor account on My Wealth Maps.
                This is not financial, legal, or tax advice.<br><br>
                <a href="${unsubscribeUrl}" style="color:#718096;">Unsubscribe from advisor emails</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
