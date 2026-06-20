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

type UrgentAppeal = {
  email: string
  request_type: string
  appeal_due_at: string
}

type MonthlySummary = {
  deletionsThisMonth: number
  pendingRequests: number
  auditFailures30Days: number
}

type OpsTaskAlert = {
  title: string
  category: string
  next_due_at: string
}

type CronJobAlert = {
  job_name: string
  last_status: string | null
  last_message: string | null
  consecutive_failures: number
}

export async function sendComplianceReportEmail(params: {
  to: string
  hasIssues: boolean
  overdueDeletions: OverdueDeletion[]
  recentFailures: DeletionFailure[]
  urgentRequests: UrgentRequest[]
  urgentAppeals?: UrgentAppeal[]
  monthlySummary: MonthlySummary | null
  overdueOpsTasks?: OpsTaskAlert[]
  dueTodayOpsTasks?: OpsTaskAlert[]
  failingCrons?: CronJobAlert[]
  staleCrons?: { job_name: string }[]
}) {
  const {
    to,
    hasIssues,
    overdueDeletions,
    recentFailures,
    urgentRequests,
    urgentAppeals = [],
    monthlySummary,
    overdueOpsTasks = [],
    dueTodayOpsTasks = [],
    failingCrons = [],
    staleCrons = [],
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

  if (overdueOpsTasks.length > 0) {
    lines.push(`⚠️ Ops tasks overdue (${overdueOpsTasks.length}):`)
    for (const t of overdueOpsTasks) {
      lines.push(`- ${t.title} (${t.category})`)
    }
    lines.push('Action: Admin → Ops Home → Ops Tasks')
    lines.push('')
  }

  if (dueTodayOpsTasks.length > 0) {
    lines.push(`📅 Ops tasks due today (${dueTodayOpsTasks.length}):`)
    for (const t of dueTodayOpsTasks) {
      lines.push(`- ${t.title} (${t.category})`)
    }
    lines.push('')
  }

  if (failingCrons.length > 0) {
    lines.push(`🔴 Cron failures (${failingCrons.length}):`)
    for (const j of failingCrons) {
      lines.push(
        `- ${j.job_name}: ${j.last_message ?? j.last_status ?? 'error'} (failures: ${j.consecutive_failures})`,
      )
    }
    lines.push('Action: Admin → Ops Home → Cron Health')
    lines.push('')
  }

  if (staleCrons.length > 0) {
    lines.push(`⚠️ Crons not heard from in 26h (${staleCrons.length}):`)
    for (const j of staleCrons) {
      lines.push(`- ${j.job_name}`)
    }
    lines.push('')
  }

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

  if (urgentAppeals.length > 0) {
    lines.push(`⚠️ PRIVACY APPEALS DUE WITHIN 7 DAYS: ${urgentAppeals.length}`)
    for (const row of urgentAppeals) {
      const due = new Date(row.appeal_due_at).toLocaleDateString('en-US')
      lines.push(`- ${row.email} — ${row.request_type} appeal — due ${due}`)
    }
    lines.push('Action: Admin Portal → Data & Compliance → Privacy Requests (appealed).')
    lines.push('')
  }

  if (monthlySummary) {
    lines.push('📋 MONTHLY SUMMARY')
    lines.push(`Deletions executed this month: ${monthlySummary.deletionsThisMonth}`)
    lines.push(`Open privacy requests: ${monthlySummary.pendingRequests}`)
    lines.push(
      `Audit log failures (30 days): ${monthlySummary.auditFailures30Days}`,
    )
    lines.push('Review: https://mywealthmaps.com/admin → Ops Home')
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
