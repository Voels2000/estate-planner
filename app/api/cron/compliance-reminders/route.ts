import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendComplianceReportEmail } from '@/lib/email/complianceReportEmail'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const complianceEmail = process.env.COMPLIANCE_EMAIL
  if (!complianceEmail) {
    console.error('[cron/compliance-reminders] COMPLIANCE_EMAIL not set')
    return NextResponse.json(
      { error: 'COMPLIANCE_EMAIL not configured' },
      { status: 500 },
    )
  }

  const admin = createAdminClient()
  const now = new Date()
  const nowIso = now.toISOString()

  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysFromNow = new Date(now)
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

  const isFirstOfMonth = now.getUTCDate() === 1

  const { data: overdueDeletions } = await admin
    .from('deletion_schedule')
    .select('id, email, scheduled_for, reason')
    .eq('status', 'pending')
    .lt('scheduled_for', nowIso)

  const { data: recentFailures } = await admin
    .from('deletion_audit_log')
    .select('id, email, reason, error_message, completed_at')
    .eq('success', false)
    .gte('completed_at', sevenDaysAgo.toISOString())

  const { data: urgentRequests } = await admin
    .from('privacy_requests')
    .select('id, email, request_type, due_at, status')
    .in('status', ['pending', 'in_progress'])
    .lte('due_at', sevenDaysFromNow.toISOString())

  let monthlySummary: {
    deletionsThisMonth: number
    pendingRequests: number
    auditFailures30Days: number
  } | null = null

  if (isFirstOfMonth) {
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

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
    overdue.length > 0 || failures.length > 0 || urgent.length > 0

  if (!hasIssues && !isFirstOfMonth) {
    return NextResponse.json({ sent: false, message: 'All clear — no email sent' })
  }

  try {
    await sendComplianceReportEmail({
      to: complianceEmail,
      hasIssues,
      overdueDeletions: overdue,
      recentFailures: failures,
      urgentRequests: urgent,
      monthlySummary,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Email send failed'
    console.error('[cron/compliance-reminders]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  console.log('[cron/compliance-reminders] Report sent to', complianceEmail)

  return NextResponse.json({
    sent: true,
    hasIssues,
    isFirstOfMonth,
    overdueCount: overdue.length,
    failureCount: failures.length,
    urgentRequestCount: urgent.length,
  })
}
