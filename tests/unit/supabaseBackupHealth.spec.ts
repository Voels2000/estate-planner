import { test, expect } from '@playwright/test'
import {
  assessSupabaseBackupHealth,
  PITR_LATEST_MAX_AGE_SEC,
  PROD_SUPABASE_PROJECT_REF,
} from '../../lib/verify/supabaseBackupHealth'

const NOW = 1_700_000_000

test.describe('assessSupabaseBackupHealth', () => {
  test('propagation fails when pitr disabled', () => {
    const r = assessSupabaseBackupHealth({ pitr_enabled: false, walg_enabled: true }, 'propagation', NOW)
    expect(r.ok).toBe(false)
    expect(r.detail).toContain('pitr_enabled=false')
  })

  test('propagation fails when latest missing', () => {
    const r = assessSupabaseBackupHealth(
      { pitr_enabled: true, physical_backup_data: {} },
      'propagation',
      NOW,
    )
    expect(r.ok).toBe(false)
    expect(r.detail).toContain('not yet protective')
  })

  test('propagation passes when pitr and latest present', () => {
    const r = assessSupabaseBackupHealth(
      {
        pitr_enabled: true,
        physical_backup_data: { latest_physical_backup_date_unix: NOW - 120 },
      },
      'propagation',
      NOW,
    )
    expect(r.ok).toBe(true)
    expect(r.detail).toContain('PITR LIVE')
  })

  test('ongoing fails when latest is stale', () => {
    const r = assessSupabaseBackupHealth(
      {
        pitr_enabled: true,
        physical_backup_data: {
          latest_physical_backup_date_unix: NOW - PITR_LATEST_MAX_AGE_SEC - 60,
          earliest_physical_backup_date_unix: NOW - 86400,
        },
      },
      'ongoing',
      NOW,
    )
    expect(r.ok).toBe(false)
    expect(r.detail).toContain('stale')
  })

  test('ongoing passes with fresh latest and warns on short window', () => {
    const r = assessSupabaseBackupHealth(
      {
        pitr_enabled: true,
        physical_backup_data: {
          latest_physical_backup_date_unix: NOW - 300,
          earliest_physical_backup_date_unix: NOW - 86400,
        },
        backups: [{ is_physical_backup: true, status: 'COMPLETED' }],
      },
      'ongoing',
      NOW,
    )
    expect(r.ok).toBe(true)
    expect(r.warnings.some((w) => w.includes('building toward'))).toBe(true)
  })

  test('prod ref constant matches release guard', () => {
    expect(PROD_SUPABASE_PROJECT_REF).toBe('fnzvlmrqwcqwiqueevux')
  })
})
