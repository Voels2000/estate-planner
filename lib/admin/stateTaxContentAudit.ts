import type { SupabaseClient } from '@supabase/supabase-js'

export type StateTaxContentAuditEntry = {
  action: 'state_tax_update'
  state_code: string
  changedFields: string[]
  adminEmail: string
  adminUserId: string
  timestamp: string
  previousValues: Record<string, unknown>
}

export const STATE_TAX_CONTENT_AUDIT_KEY = 'state_tax_content_audit_log'
const MAX_AUDIT_ENTRIES = 50

export async function appendStateTaxContentAudit(
  admin: SupabaseClient,
  entry: StateTaxContentAuditEntry,
): Promise<void> {
  const { data: existing } = await admin
    .from('app_config')
    .select('value')
    .eq('key', STATE_TAX_CONTENT_AUDIT_KEY)
    .maybeSingle()

  const prior = Array.isArray(existing?.value) ? existing.value : []
  const next = [entry, ...prior].slice(0, MAX_AUDIT_ENTRIES)

  await admin.from('app_config').upsert({
    key: STATE_TAX_CONTENT_AUDIT_KEY,
    value: next,
    description: 'Last 50 state estate tax content admin updates (public /learn pages)',
  })
}

export async function getStateTaxContentAuditLog(
  admin: SupabaseClient,
): Promise<StateTaxContentAuditEntry[]> {
  const { data: existing } = await admin
    .from('app_config')
    .select('value')
    .eq('key', STATE_TAX_CONTENT_AUDIT_KEY)
    .maybeSingle()

  const entries = Array.isArray(existing?.value) ? existing.value : []
  return entries as StateTaxContentAuditEntry[]
}
