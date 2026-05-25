import { resend } from '@/lib/resend'

type OverdueDeletion = {
  email: string
  scheduled_for: string
  reason: string
}

type DeletionFailure = {
  email: string
  error_message: string | null
  completed_at: string
}

type UrgentRequest = {
  email: string
  request_type: string
  due_at: string
}

type MonthlySummary = {
  deletionsThisMonth: number
  pendingRequests: number
  auditFailures30Days: number
}

export async function sendComplianceReportEmail(params: {
  to: string
  hasIssues: boolean
  overdueDeletions: OverdueDeletion[]
  recentFailures: DeletionFailure[]
  urgentRequests: UrgentRequest[]
  monthlySummary: MonthlySummary | null
}) {
  const {
    to,
    hasIssues,
    overdueDeletions,
    recentFailures,
    urgentRequests,
    monthlySummary,
  } = params

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const lines: string[] = [
    'My Wealth Maps — Compliance Report',
    dateStr,
    '',
  ]

  if (overdueDeletions.length > 0) {
    lines.push(`⚠️ OVERDUE SCHEDULED DELETIONS: ${overdueDeletions.length}`)
    lines.push(
      'These users were scheduled for deletion but the cron did not execute:',
    )
    for (const row of overdueDeletions) {
      const scheduled = new Date(row.scheduled_for).toLocaleDateString('en-US')
      lines.push(`- ${row.email} (scheduled ${scheduled}, reason: ${row.reason})`)
    }
    lines.push('Action: Check /api/cron/process-deletions logs in Vercel.')
    lines.push('')
  }

  if (recentFailures.length > 0) {
    lines.push(`⚠️ DELETION FAILURES (last 7 days): ${recentFailures.length}`)
    for (const row of recentFailures) {
      const when = new Date(row.completed_at).toLocaleDateString('en-US')
      lines.push(
        `- ${row.email} failed on ${when}: ${row.error_message ?? 'unknown error'}`,
      )
    }
    lines.push('Action: Admin Portal → Data & Compliance → Audit Log.')
    lines.push('')
  }

  if (urgentRequests.length > 0) {
    lines.push(`⚠️ PRIVACY REQUESTS DUE WITHIN 7 DAYS: ${urgentRequests.length}`)
    for (const row of urgentRequests) {
      const due = new Date(row.due_at).toLocaleDateString('en-US')
      lines.push(`- ${row.email} — ${row.request_type} — due ${due}`)
    }
    lines.push('Action: Admin Portal → Data & Compliance → Privacy Requests.')
    lines.push('')
  }

  if (monthlySummary) {
    lines.push('📋 MONTHLY SUMMARY')
    lines.push(`Deletions executed this month: ${monthlySummary.deletionsThisMonth}`)
    lines.push(`Open privacy requests: ${monthlySummary.pendingRequests}`)
    lines.push(
      `Audit log failures (30 days): ${monthlySummary.auditFailures30Days}`,
    )
    lines.push('Review: https://mywealthmaps.com/admin → Data & Compliance')
    lines.push('')
  }

  lines.push('---')
  lines.push('This email is sent by the My Wealth Maps compliance cron.')
  lines.push('To adjust frequency, update vercel.json cron schedule.')

  const text = lines.join('\n')

  const subject = hasIssues
    ? '⚠️ My Wealth Maps — Compliance action required'
    : '📋 My Wealth Maps — Monthly compliance summary'

  const { error } = await resend.emails.send({
    from: 'My Wealth Maps <hello@mywealthmaps.com>',
    to,
    subject,
    text,
    html: `<pre style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap">${text.replace(/</g, '&lt;')}</pre>`,
  })

  if (error) throw error
}
