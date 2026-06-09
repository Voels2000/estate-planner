import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendComplianceReportEmail } from '@/lib/email/complianceReportEmail'
import { recordCronHealth } from '@/lib/cron/recordCronHealth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const complianceEmail = process.env.COMPLIANCE_EMAIL
  if (!complianceEmail) {
    console.error('[cron/compliance-reminders] COMPLIANCE_EMAIL not set')
    await recordCronHealth('compliance-reminders', 'error', 'COMPLIANCE_EMAIL not set')
    return NextResponse.json(
      { error: 'COMPLIANCE_EMAIL not configured' },
      { status: 500 },
    )
  }

  try {
    const admin = createAdminClient()
    const now = new Date()
    const nowIso = now.toISOString()

    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysFromNow = new Date(now)
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
    const sevenDaysOutIso = sevenDaysFromNow.toISOString()

    const isFirstOfMonth = now.getUTCDate() === 1

    const [
      { data: overdueDeletions },
      { data: recentFailures },
      { data: urgentRequests },
      { data: dueTasks },
      { data: cronJobs },
    ] = await Promise.all([
      admin
        .from('deletion_schedule')
        .select('id, email, scheduled_for, reason')
        .eq('status', 'pending')
        .lt('scheduled_for', nowIso),
      admin
        .from('deletion_audit_log')
        .select('id, email, reason, error_message, completed_at')
        .eq('success', false)
        .gte('completed_at', sevenDaysAgo.toISOString()),
      admin
        .from('privacy_requests')
        .select('id, email, request_type, due_at, status')
        .in('status', ['pending', 'in_progress'])
        .lte('due_at', sevenDaysFromNow.toISOString()),
      admin
        .from('ops_tasks')
        .select('slug, title, cadence, next_due_at, category, status')
        .lte('next_due_at', sevenDaysOutIso)
        .neq('status', 'completed')
        .order('next_due_at', { ascending: true }),
      admin.from('cron_health').select('*'),
    ])

    const overdueTasks =
      dueTasks?.filter((t) => new Date(t.next_due_at) < now) ?? []
    const dueSoonTasks =
      dueTasks?.filter((t) => new Date(t.next_due_at) >= now) ?? []

    if (overdueTasks.length > 0) {
      await admin
        .from('ops_tasks')
        .update({ status: 'overdue', updated_at: nowIso })
        .in(
          'slug',
          overdueTasks.map((t) => t.slug),
        )
    }

    const dueTodayTasks = dueSoonTasks.filter((t) => {
      const diff = new Date(t.next_due_at).getTime() - now.getTime()
      return diff < 24 * 60 * 60 * 1000
    })

    const staleThreshold = new Date(Date.now() - 26 * 60 * 60 * 1000)
    const failingCrons =
      cronJobs?.filter(
        (j) =>
          j.last_status === 'error' || (j.consecutive_failures ?? 0) > 1,
      ) ?? []
    const staleCrons =
      cronJobs?.filter(
        (j) => !j.last_run_at || new Date(j.last_run_at) < staleThreshold,
      ) ?? []

    let monthlySummary: {
      deletionsThisMonth: number
      pendingRequests: number
      auditFailures30Days: number
    } | null = null

    if (isFirstOfMonth) {
      const startOfMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      )
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { count: deletionsThisMonth } = await admin
        .from('deletion_audit_log')
        .select('*', { count: 'exact', head: true })
        .eq('success', true)
        .eq('dry_run', false)
        .gte('completed_at', startOfMonth.toISOString())

      const { count: pendingRequests } = await admin
        .from('privacy_requests')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'in_progress'])

      const { count: auditFailures30Days } = await admin
        .from('deletion_audit_log')
        .select('*', { count: 'exact', head: true })
        .eq('success', false)
        .gte('completed_at', thirtyDaysAgo.toISOString())

      monthlySummary = {
        deletionsThisMonth: deletionsThisMonth ?? 0,
        pendingRequests: pendingRequests ?? 0,
        auditFailures30Days: auditFailures30Days ?? 0,
      }
    }

    const overdue = overdueDeletions ?? []
    const failures = recentFailures ?? []
    const urgent = urgentRequests ?? []

    const hasIssues =
      overdue.length > 0 ||
      failures.length > 0 ||
      urgent.length > 0 ||
      overdueTasks.length > 0 ||
      dueTodayTasks.length > 0 ||
      failingCrons.length > 0 ||
      staleCrons.length > 0

    if (!hasIssues && !isFirstOfMonth) {
      await recordCronHealth('compliance-reminders', 'ok', 'All clear — no email sent')
      return NextResponse.json({ sent: false, message: 'All clear — no email sent' })
    }

    await sendComplianceReportEmail({
      to: complianceEmail,
      hasIssues,
      overdueDeletions: overdue,
      recentFailures: failures,
      urgentRequests: urgent,
      monthlySummary,
      overdueOpsTasks: overdueTasks,
      dueTodayOpsTasks: dueTodayTasks,
      failingCrons,
      staleCrons,
    })

    console.log('[cron/compliance-reminders] Report sent to', complianceEmail)
    await recordCronHealth(
      'compliance-reminders',
      hasIssues ? 'warning' : 'ok',
      `sent=${hasIssues || isFirstOfMonth}`,
    )

    return NextResponse.json({
      sent: true,
      hasIssues,
      isFirstOfMonth,
      overdueCount: overdue.length,
      failureCount: failures.length,
      urgentRequestCount: urgent.length,
      overdueOpsTasks: overdueTasks.length,
      dueTodayOpsTasks: dueTodayTasks.length,
      failingCrons: failingCrons.length,
      staleCrons: staleCrons.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Compliance cron failed'
    console.error('[cron/compliance-reminders]', message)
    await recordCronHealth('compliance-reminders', 'error', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
