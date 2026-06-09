import type { SupabaseClient } from '@supabase/supabase-js'

export type FederalConfigAuditEntry = {
  action: 'federal_config_update'
  updatedAt: string
  adminEmail: string
  adminUserId: string
  configId: string
  scenarioId?: string | null
  changes: Record<string, { old: unknown; new: unknown }>
}

const TAX_ROLLOVER_AUDIT_KEY = 'tax_rollover_audit_log'
const MAX_AUDIT_ENTRIES = 50

export async function appendFederalTaxConfigAudit(
  admin: SupabaseClient,
  entry: FederalConfigAuditEntry,
): Promise<void> {
  const { data: existing } = await admin
    .from('app_config')
    .select('value')
    .eq('key', TAX_ROLLOVER_AUDIT_KEY)
    .maybeSingle()

  const prior = Array.isArray(existing?.value) ? existing.value : []
  const next = [entry, ...prior].slice(0, MAX_AUDIT_ENTRIES)

  await admin.from('app_config').upsert({
    key: TAX_ROLLOVER_AUDIT_KEY,
    value: next,
    description: 'Last 50 tax rule rollover apply events (admin workflow)',
  })
}

export async function getLastFederalConfigUpdate(
  admin: SupabaseClient,
): Promise<FederalConfigAuditEntry | null> {
  const { data: existing } = await admin
    .from('app_config')
    .select('value')
    .eq('key', TAX_ROLLOVER_AUDIT_KEY)
    .maybeSingle()

  const entries = Array.isArray(existing?.value) ? existing.value : []
  const match = entries.find(
    (e: { action?: string }) => e?.action === 'federal_config_update',
  )
  return (match as FederalConfigAuditEntry) ?? null
}
