import { resend } from '@/lib/resend'

export async function sendDeletionRetryAlertEmail(params: {
  to: string
  email: string
  retryCount: number
  lastError: string
}) {
  const lines = [
    'My Wealth Maps — Scheduled deletion failed (retry alert)',
    '',
    `User: ${params.email}`,
    `Retry count: ${params.retryCount}`,
    `Last error: ${params.lastError}`,
    '',
    'Action: Admin → Data & Compliance → Scheduled Deletions / Execute Deletion',
  ]

  const text = lines.join('\n')

  const { error } = await resend.emails.send({
    from: 'My Wealth Maps <hello@mywealthmaps.com>',
    to: params.to,
    subject: `⚠️ Deletion failed after ${params.retryCount} retries — ${params.email}`,
    text,
    html: `<pre style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap">${text.replace(/</g, '&lt;')}</pre>`,
  })

  if (error) throw error
}

function deletionBackoffMs(retryCount: number): number {
  if (retryCount <= 1) return 60 * 60 * 1000
  if (retryCount === 2) return 4 * 60 * 60 * 1000
  if (retryCount === 3) return 24 * 60 * 60 * 1000
  return 72 * 60 * 60 * 1000
}

export function nextDeletionRetryAt(retryCount: number, from = new Date()): string {
  const next = new Date(from.getTime() + deletionBackoffMs(retryCount))
  return next.toISOString()
}
