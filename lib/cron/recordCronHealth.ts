import { createAdminClient } from '@/lib/supabase/admin'

export type CronHealthStatus = 'ok' | 'warning' | 'error'

export async function recordCronHealth(
  jobName: string,
  status: CronHealthStatus,
  message?: string,
): Promise<void> {
  try {
    const supabase = createAdminClient()
    const now = new Date().toISOString()

    const { data: existing } = await supabase
      .from('cron_health')
      .select('consecutive_failures')
      .eq('job_name', jobName)
      .maybeSingle()

    const consecutiveFailures =
      status === 'error' ? (existing?.consecutive_failures ?? 0) + 1 : 0

    await supabase.from('cron_health').upsert(
      {
        job_name: jobName,
        last_run_at: now,
        last_status: status,
        last_message: message ?? null,
        consecutive_failures: consecutiveFailures,
        updated_at: now,
      },
      { onConflict: 'job_name' },
    )
  } catch (err) {
    console.error('[recordCronHealth]', jobName, err)
  }
}
