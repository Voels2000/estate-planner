import {
  assessSupabaseBackupHealth,
  fetchSupabaseBackups,
  PROD_SUPABASE_PROJECT_REF,
} from '@/lib/verify/supabaseBackupHealth'
import type { EnvFlag } from '@/lib/env/verifyEnv'

function parseRef(url: string | undefined): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null
  try {
    const ref = new URL(trimmed).hostname.split('.')[0]
    return ref && ref !== 'localhost' ? ref : null
  } catch {
    return null
  }
}

export type SupabaseBackupLiveness = {
  status: 'LIVE_OK' | 'LIVE_FAIL' | 'SKIPPED'
  pitr_enabled?: boolean
  walg_enabled?: boolean
  latest_iso?: string
  earliest_iso?: string
  reason?: string
  warnings?: string[]
}

export async function verifySupabaseBackupLiveness(options: {
  supabaseUrl: string | undefined
  accessToken: string | undefined
  isProductionScope: boolean
}): Promise<{ liveness: SupabaseBackupLiveness; flags: EnvFlag[] }> {
  const flags: EnvFlag[] = []
  const ref = parseRef(options.supabaseUrl)

  if (ref !== PROD_SUPABASE_PROJECT_REF) {
    return {
      liveness: { status: 'SKIPPED', reason: 'backup gate applies to prod Supabase ref only' },
      flags,
    }
  }

  if (!options.isProductionScope) {
    return {
      liveness: { status: 'SKIPPED', reason: 'PITR gate runs on production deployment scope only' },
      flags,
    }
  }

  const token = options.accessToken?.trim()
  if (!token) {
    flags.push({
      name: 'SUPABASE_ACCESS_TOKEN',
      level: 'WARN',
      reason: 'Unset — cannot verify PITR via Management API on verify-env?live=1.',
      action:
        'Create a Supabase personal access token; set SUPABASE_ACCESS_TOKEN on Vercel Production (estate-planner).',
    })
    flags.push({
      name: 'PITR_BACKUP_HEALTH',
      level: 'WARN',
      reason: 'Backup posture not verified (no Management API token).',
      action: 'Set SUPABASE_ACCESS_TOKEN and re-run verify-env?live=1.',
    })
    return {
      liveness: { status: 'SKIPPED', reason: 'SUPABASE_ACCESS_TOKEN unset' },
      flags,
    }
  }

  try {
    const data = await fetchSupabaseBackups(ref, token)
    const assessment = assessSupabaseBackupHealth(data, 'ongoing')
    const latest = data.physical_backup_data?.latest_physical_backup_date_unix
    const earliest = data.physical_backup_data?.earliest_physical_backup_date_unix

    const liveness: SupabaseBackupLiveness = {
      status: assessment.ok ? 'LIVE_OK' : 'LIVE_FAIL',
      pitr_enabled: data.pitr_enabled,
      walg_enabled: data.walg_enabled,
      latest_iso: latest ? new Date(latest * 1000).toISOString() : undefined,
      earliest_iso: earliest ? new Date(earliest * 1000).toISOString() : undefined,
      reason: assessment.ok ? undefined : assessment.detail,
      warnings: assessment.warnings.length ? assessment.warnings : undefined,
    }

    if (!data.pitr_enabled) {
      flags.push({
        name: 'PITR_BACKUP_HEALTH',
        level: 'CRITICAL',
        reason: 'PITR is not enabled on prod Supabase (pitr_enabled=false).',
        action:
          'Supabase Dashboard → estate-planner-prod → Database → Point in Time Recovery → enable; then npm run check:pitr-prod until exit 0.',
      })
    } else if (!assessment.ok) {
      flags.push({
        name: 'PITR_BACKUP_HEALTH',
        level: 'CRITICAL',
        reason: assessment.detail,
        action: 'Check Supabase backup dashboard; run npm run check:pitr-prod until propagation completes.',
      })
    } else {
      for (const w of assessment.warnings) {
        flags.push({
          name: 'PITR_BACKUP_HEALTH',
          level: 'WARN',
          reason: w,
          action: 'Re-check in 24h — window should extend toward 7-day retention.',
        })
      }
    }

    return { liveness, flags }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Supabase backups API failed'
    flags.push({
      name: 'PITR_BACKUP_HEALTH',
      level: 'CRITICAL',
      reason,
      action: 'Confirm SUPABASE_ACCESS_TOKEN is valid and has project access.',
    })
    return {
      liveness: { status: 'LIVE_FAIL', reason },
      flags,
    }
  }
}
