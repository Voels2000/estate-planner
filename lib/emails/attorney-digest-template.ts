import { getAppUrl } from '@/lib/app-url'
import type { AttorneyDigestData } from '@/lib/attorney/getAttorneyDigestData'

export type AttorneyDigestEmail = {
  subject: string
  headline: string
  bodyHtml: string
  cta: string
  ctaUrl: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDocType(value: string): string {
  return value.replace(/_/g, ' ')
}

export function buildAttorneyDigestEmail(data: AttorneyDigestData): AttorneyDigestEmail {
  const baseUrl = getAppUrl()
  const { summary } = data

  const summaryLines: string[] = []
  if (summary.clientsWithGaps > 0) {
    summaryLines.push(
      `<strong>${summary.clientsWithGaps}</strong> client${summary.clientsWithGaps === 1 ? '' : 's'} with document gaps`,
    )
  }
  if (summary.pendingRequestCount > 0) {
    summaryLines.push(
      `<strong>${summary.pendingRequestCount}</strong> pending document request${summary.pendingRequestCount === 1 ? '' : 's'}`,
    )
  }
  if (summary.staleMatterCount > 0) {
    summaryLines.push(
      `<strong>${summary.staleMatterCount}</strong> matter${summary.staleMatterCount === 1 ? '' : 's'} needing stage review`,
    )
  }

  const clientBlocks = data.clients
    .filter(
      (c) =>
        c.documentGaps.length > 0 ||
        c.pendingDocRequests.length > 0 ||
        c.isStaleMatter,
    )
    .map((client) => {
      const parts: string[] = []
      parts.push(
        `<p style="margin:0 0 8px;font-weight:700;color:#0F1B3C">${escapeHtml(client.clientName)}</p>`,
      )
      parts.push(
        `<p style="margin:0 0 12px;font-size:13px;color:#6b7280">Stage: ${escapeHtml(client.matterStageLabel)}</p>`,
      )

      if (client.documentGaps.length > 0) {
        const gapItems = client.documentGaps
          .map((g) => `<li>${escapeHtml(g.label)}</li>`)
          .join('')
        parts.push(
          `<p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#991b1b">Document gaps</p><ul style="margin:0 0 12px;padding-left:20px;color:#4b5563;font-size:14px">${gapItems}</ul>`,
        )
      }

      if (client.pendingDocRequests.length > 0) {
        const reqItems = client.pendingDocRequests
          .map(
            (r) =>
              `<li>${escapeHtml(formatDocType(r.document_type))}${r.message ? ` — ${escapeHtml(r.message)}` : ''}</li>`,
          )
          .join('')
        parts.push(
          `<p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#92400e">Pending requests</p><ul style="margin:0 0 12px;padding-left:20px;color:#4b5563;font-size:14px">${reqItems}</ul>`,
        )
      }

      if (client.isStaleMatter) {
        parts.push(
          `<p style="margin:0;font-size:13px;color:#b45309">Matter stage may need updating — open client to review workflow.</p>`,
        )
      }

      return `<div style="margin-bottom:24px;padding:16px;border:1px solid #e5e7eb;border-radius:6px">${parts.join('')}</div>`
    })
    .join('')

  const bodyHtml = `<p style="margin:0 0 16px">Hi ${escapeHtml(data.attorneyName)},</p>
<p style="margin:0 0 16px">Here is your weekly summary across <strong>${summary.totalClients}</strong> active client${summary.totalClients === 1 ? '' : 's'}:</p>
<ul style="margin:0 0 24px;padding-left:20px;color:#4b5563;line-height:1.7">
  ${summaryLines.map((line) => `<li>${line}</li>`).join('')}
</ul>
${clientBlocks}`

  return {
    subject: `Weekly client summary — ${summary.clientsWithGaps + summary.pendingRequestCount + summary.staleMatterCount} item${summary.clientsWithGaps + summary.pendingRequestCount + summary.staleMatterCount === 1 ? '' : 's'} need attention`,
    headline: 'Your weekly client summary',
    bodyHtml,
    cta: 'Open attorney portal',
    ctaUrl: `${baseUrl}/attorney`,
  }
}

export function buildAttorneyDigestEmailHtml(opts: {
  email: AttorneyDigestEmail
}): string {
  const { email } = opts

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
      <div style="color:#4b5563;font-size:15px;line-height:1.7">${email.bodyHtml}</div>
      <div style="text-align:center;margin:32px 0">
        <a href="${email.ctaUrl}"
           style="display:inline-block;background:#C9A84C;color:#0F1B3C;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:0.02em">
          ${email.cta} →
        </a>
      </div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">
      <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0">
        You're receiving this weekly summary because you have an active attorney account on My Wealth Maps.
      </p>
    </div>
  </div>
</body>
</html>`
}
