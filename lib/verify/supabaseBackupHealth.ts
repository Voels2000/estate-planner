/** Prod Supabase project — backup/PITR gates apply only here. */
export const PROD_SUPABASE_PROJECT_REF = 'fnzvlmrqwcqwiqueevux'

/** PITR WAL archive considered stale if LATEST is older than this (ongoing cron). */
export const PITR_LATEST_MAX_AGE_SEC = 30 * 60

/** Warn when recovery window is shorter than ~6 days (still building toward 7-day retention). */
export const PITR_TARGET_WINDOW_WARN_SEC = 6 * 24 * 3600

export type SupabaseBackupsPayload = {
  pitr_enabled?: boolean
  walg_enabled?: boolean
  region?: string
  physical_backup_data?: {
    earliest_physical_backup_date_unix?: number | null
    latest_physical_backup_date_unix?: number | null
  } | null
  backups?: Array<{
    inserted_at?: string
    status?: string
    is_physical_backup?: boolean
  }>
}

export type BackupHealthAssessment = {
  ok: boolean
  detail: string
  warnings: string[]
}

export async function fetchSupabaseBackups(
  projectRef: string,
  accessToken: string,
): Promise<SupabaseBackupsPayload> {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/backups`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Supabase backups API ${res.status}: ${body.slice(0, 200)}`)
  }
  return (await res.json()) as SupabaseBackupsPayload
}

/**
 * propagation — one-time gate while PITR window builds (check-pitr-prod.sh).
 * ongoing — daily cron / verify-env: PITR on, LATEST fresh, optional window WARN.
 */
export function assessSupabaseBackupHealth(
  data: SupabaseBackupsPayload,
  mode: 'propagation' | 'ongoing',
  nowSec = Math.floor(Date.now() / 1000),
): BackupHealthAssessment {
  const warnings: string[] = []
  const latest = data.physical_backup_data?.latest_physical_backup_date_unix ?? null
  const earliest = data.physical_backup_data?.earliest_physical_backup_date_unix ?? null

  if (!data.pitr_enabled) {
    return {
      ok: false,
      detail: `pitr_enabled=false (walg=${String(data.walg_enabled ?? false)})`,
      warnings,
    }
  }

  if (latest == null || latest <= 0) {
    return {
      ok: false,
      detail: 'PITR enabled but latest_physical_backup_date_unix missing — window not yet protective',
      warnings,
    }
  }

  if (mode === 'propagation') {
    return {
      ok: true,
      detail: `PITR LIVE: latest=${new Date(latest * 1000).toISOString()}${
        earliest ? ` earliest=${new Date(earliest * 1000).toISOString()}` : ''
      }`,
      warnings,
    }
  }

  const latestAgeSec = nowSec - latest
  if (latestAgeSec > PITR_LATEST_MAX_AGE_SEC) {
    return {
      ok: false,
      detail: `PITR LATEST stale: ${Math.round(latestAgeSec / 60)}m ago (max ${PITR_LATEST_MAX_AGE_SEC / 60}m)`,
      warnings,
    }
  }

  if (earliest != null && earliest > 0) {
    const windowSec = latest - earliest
    if (windowSec < PITR_TARGET_WINDOW_WARN_SEC) {
      warnings.push(
        `recovery window ${Math.round(windowSec / 86400)}d — still building toward 7d retention`,
      )
    }
  }

  const completedDaily = (data.backups ?? []).filter(
    (b) => b.is_physical_backup && b.status === 'COMPLETED',
  )
  const detail = [
    `pitr=true`,
    `latest=${new Date(latest * 1000).toISOString()}`,
    earliest ? `earliest=${new Date(earliest * 1000).toISOString()}` : null,
    `daily_snapshots=${completedDaily.length}`,
  ]
    .filter(Boolean)
    .join(' ')

  return { ok: true, detail, warnings }
}

export type PostDeployCheck = { id: string; pass: boolean; detail: string }

/** Daily cron + manual — prod ref only; skips staging/other projects. */
export async function runProdBackupHealthCheck(options?: {
  supabaseUrl?: string
  accessToken?: string
  mode?: 'propagation' | 'ongoing'
}): Promise<PostDeployCheck | null> {
  const url = options?.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const ref = url ? new URL(url).hostname.split('.')[0] : null

  if (ref !== PROD_SUPABASE_PROJECT_REF) {
    return null
  }

  const token = options?.accessToken ?? process.env.SUPABASE_ACCESS_TOKEN?.trim()
  if (!token) {
    return {
      id: 'backup-health',
      pass: false,
      detail: 'SUPABASE_ACCESS_TOKEN unset — cannot verify PITR (Management API)',
    }
  }

  const mode = options?.mode ?? 'ongoing'

  try {
    const data = await fetchSupabaseBackups(ref, token)
    const assessment = assessSupabaseBackupHealth(data, mode)
    const warnSuffix =
      assessment.warnings.length > 0 ? `; ${assessment.warnings.join('; ')}` : ''
    return {
      id: 'backup-health',
      pass: assessment.ok,
      detail: assessment.ok
        ? `${assessment.detail}${warnSuffix}`
        : assessment.detail,
    }
  } catch (err) {
    return {
      id: 'backup-health',
      pass: false,
      detail: err instanceof Error ? err.message : 'backup health fetch failed',
    }
  }
}
