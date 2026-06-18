import { getAppUrl } from '@/lib/app-url'
import { ATTORNEY_PLAN_LIMITS } from '@/lib/tiers'

export type AttorneyDripEmail = {
  subject: string
  headline: string
  body: string
  cta: string
  ctaUrl: string
}

export type AttorneyDripSequence = {
  email1: AttorneyDripEmail
  email2: AttorneyDripEmail
  email3: AttorneyDripEmail
}

/** Attorney onboarding drip — profiles.attorney_drip_step_*_sent_at; unsubscribe → attorney_drip_unsubscribed_at. */
export function getAttorneyDripSequence(): AttorneyDripSequence {
  const baseUrl = getAppUrl()

  return {
    email1: {
      subject: 'Your My Wealth Maps attorney portal is ready',
      headline: 'Welcome to My Wealth Maps',
      body: `<p>You now have access to your client's estate plan data through your attorney portal on My Wealth Maps.</p>
<p>Here's what to do first:</p>
<ul>
  <li><strong>Review their estate summary</strong> — assets, titling, beneficiary designations, and existing documents</li>
  <li><strong>Check the document gaps</strong> — see which documents are missing or need updating</li>
  <li><strong>Upload completed documents</strong> — store executed Wills, POAs, and trust documents directly in their vault</li>
</ul>
<p>Your client receives a notification each time you upload a document, so they always know what's on file.</p>`,
      cta: 'Open your attorney portal',
      ctaUrl: `${baseUrl}/attorney`,
    },
    email2: {
      subject: 'Replace your paper intake form with My Wealth Maps',
      headline: 'A better intake experience for your clients',
      body: `<p>Before your next estate planning engagement, try this:</p>
<ol>
  <li>Ask your client to complete their financial profile on My Wealth Maps (takes 15–20 minutes)</li>
  <li>Grant you attorney access — they do this from their settings in one click</li>
  <li>You receive their full financial picture: assets by titling, beneficiary designations, existing document inventory, and estate tax exposure</li>
</ol>
<p>The intake summary is available as a formatted PDF you can attach to your engagement file.</p>
<p>No more PDFs emailed back and forth. No more re-entering data.</p>`,
      cta: "See your clients' intake summaries",
      ctaUrl: `${baseUrl}/attorney`,
    },
    email3: {
      subject: 'Managing more than 3 clients? Here\'s your next step.',
      headline: 'Scale your estate practice with My Wealth Maps',
      body: `<p>The free plan gives you access to your first 3 client households. If you're ready to use My Wealth Maps across your practice, Attorney Starter includes:</p>
<ul>
  <li><strong>Up to 15 active client households</strong></li>
  <li><strong>Intake summary PDF export</strong> — formatted client summaries you can bill against</li>
  <li><strong>Multi-client document dashboard</strong> — see which clients are missing DPOAs, Wills, or other documents at a glance</li>
  <li><strong>Document status tracking</strong> — Draft, Pending Execution, Executed, Recorded</li>
</ul>
<p>Attorney Starter is $${ATTORNEY_PLAN_LIMITS.starter.priceMonthly}/month. No contracts — cancel anytime.</p>`,
      cta: 'View attorney plans',
      ctaUrl: `${baseUrl}/attorney/billing`,
    },
  }
}

export function buildAttorneyDripEmailHtml(opts: {
  email: AttorneyDripEmail
  unsubscribeUrl: string
}): string {
  const { email, unsubscribeUrl } = opts
  const baseUrl = getAppUrl()

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#0F1B3C;padding:28px 40px">
      <p style="margin:0;color:#C9A84C;font-size:13px;letter-spacing:0.1em;text-transform:uppercase">My Wealth Maps</p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:400;line-height:1.3">${email.headline}</h1>
    </div>
    <div style="padding:36px 40px">
      <div style="color:#4b5563;font-size:15px;line-height:1.7">${email.body}</div>
      <div style="text-align:center;margin:32px 0">
        <a href="${email.ctaUrl}"
           style="display:inline-block;background:#C9A84C;color:#0F1B3C;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:0.02em">
          ${email.cta} →
        </a>
      </div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">
      <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0">
        You're receiving this because you registered as an attorney on My Wealth Maps.
        <a href="${unsubscribeUrl}" style="color:#9ca3af">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`
}
