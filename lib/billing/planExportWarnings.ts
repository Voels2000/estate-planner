import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPlanExportWindowWarningEmail } from '@/lib/email/planExportWindowWarningEmail'
import { planExportEmailWarningDue } from '@/lib/billing/planExportAccess'
import { PLAN_AND_EXPORT_SKU } from '@/lib/billing/stripePrices'

export type PlanExportWarningRow = {
  id: string
  user_id: string
  edit_window_ends_at: string
  warning_14d_sent_at: string | null
  warning_3d_sent_at: string | null
}

export type ProcessPlanExportWarningsResult = {
  scanned: number
  sent14d: number
  sent3d: number
  errors: number
}

export async function processPlanExportWarnings(
  admin: SupabaseClient,
  now: Date = new Date(),
): Promise<ProcessPlanExportWarningsResult> {
  const result: ProcessPlanExportWarningsResult = {
    scanned: 0,
    sent14d: 0,
    sent3d: 0,
    errors: 0,
  }

  const { data: rows, error } = await admin
    .from('one_time_purchases')
    .select('id, user_id, edit_window_ends_at, warning_14d_sent_at, warning_3d_sent_at')
    .eq('sku', PLAN_AND_EXPORT_SKU)
    .eq('status', 'completed')
    .is('credit_applied_at', null)
    .gt('edit_window_ends_at', now.toISOString())

  if (error) {
    throw new Error(error.message)
  }

  for (const row of (rows ?? []) as PlanExportWarningRow[]) {
    result.scanned += 1

    const warning = planExportEmailWarningDue(
      row.edit_window_ends_at,
      row.warning_14d_sent_at,
      row.warning_3d_sent_at,
      now,
    )
    if (!warning) continue

    const column = warning === 14 ? 'warning_14d_sent_at' : 'warning_3d_sent_at'
    const sentAt = now.toISOString()

    const { data: claimed, error: claimError } = await admin
      .from('one_time_purchases')
      .update({ [column]: sentAt })
      .eq('id', row.id)
      .is(column, null)
      .select('id')
      .maybeSingle()

    if (claimError || !claimed) {
      if (claimError) result.errors += 1
      continue
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('email')
      .eq('id', row.user_id)
      .maybeSingle()

    const to = profile?.email?.trim()
    if (!to) {
      result.errors += 1
      await admin
        .from('one_time_purchases')
        .update({ [column]: null })
        .eq('id', row.id)
      continue
    }

    try {
      await sendPlanExportWindowWarningEmail({
        to,
        daysRemaining: warning,
        lockDateIso: row.edit_window_ends_at,
      })
      if (warning === 14) result.sent14d += 1
      else result.sent3d += 1
    } catch {
      result.errors += 1
      await admin
        .from('one_time_purchases')
        .update({ [column]: null })
        .eq('id', row.id)
    }
  }

  return result
}
