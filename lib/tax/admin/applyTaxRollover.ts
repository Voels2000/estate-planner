import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaxApplyResult, TaxDomain, TaxRolloverDraft } from '@/lib/tax/admin/types'

type ApplyOptions = {
  draft: TaxRolloverDraft
  appliedBy: string
  overwrite: boolean
  acknowledgedManualVerify: boolean
}

const TABLE_BY_DOMAIN: Record<Exclude<TaxDomain, 'federal_tax_config'>, string> = {
  federal_estate_tax_brackets: 'federal_estate_tax_brackets',
  federal_tax_brackets: 'federal_tax_brackets',
  state_estate_tax_rules: 'state_estate_tax_rules',
  state_income_tax_brackets: 'state_income_tax_brackets',
  state_inheritance_tax_rules: 'state_inheritance_tax_rules',
  irmaa_brackets: 'irmaa_brackets',
}

async function appendAuditLog(
  admin: SupabaseClient,
  entry: TaxApplyResult,
): Promise<void> {
  const key = 'tax_rollover_audit_log'
  const { data: existing } = await admin.from('app_config').select('value').eq('key', key).maybeSingle()
  const prior = Array.isArray(existing?.value) ? existing.value : []
  const next = [entry, ...prior].slice(0, 50)
  await admin.from('app_config').upsert({
    key,
    value: next,
    description: 'Last 50 tax rule rollover apply events (admin workflow)',
  })
}

export async function applyTaxRollover(
  admin: SupabaseClient,
  options: ApplyOptions,
): Promise<TaxApplyResult> {
  const { draft, appliedBy, overwrite, acknowledgedManualVerify } = options
  const { targetYear, manualVerify } = draft

  const needsAck =
    manualVerify.sections.length > 0 ||
    manualVerify.stateEstate.length > 0 ||
    manualVerify.stateIncome.length > 0
  if (needsAck && !acknowledgedManualVerify) {
    throw new Error(
      'Acknowledge manual verification for flagged federal sections and states before applying.',
    )
  }

  if (draft.targetYearAlreadyHasData && !overwrite) {
    throw new Error(
      `Target year ${targetYear} already has data. Enable overwrite to replace existing rows.`,
    )
  }

  const rowsDeleted: Partial<Record<TaxDomain, number>> = {}
  const rowsInserted: Partial<Record<TaxDomain, number>> = {}
  const sectionsApplied: TaxDomain[] = []

  for (const [domain, table] of Object.entries(TABLE_BY_DOMAIN) as [
    Exclude<TaxDomain, 'federal_tax_config'>,
    string,
  ][]) {
    const rows = draft.payload[domain]
    if (!rows?.length) continue

    if (domain === 'federal_tax_brackets') {
      const filingStatuses = [...new Set(rows.map((r) => String(r.filing_status)))]
      const { count: delCount, error: delErr } = await admin
        .from(table)
        .delete({ count: 'exact' })
        .in('filing_status', filingStatuses)
      if (delErr) throw new Error(`${table} delete: ${delErr.message}`)
      rowsDeleted[domain] = delCount ?? 0
    } else {
      const { count: delCount, error: delErr } = await admin
        .from(table)
        .delete({ count: 'exact' })
        .eq('tax_year', targetYear)
      if (delErr) throw new Error(`${table} delete: ${delErr.message}`)
      rowsDeleted[domain] = delCount ?? 0
    }

    const { error: insErr } = await admin.from(table).insert(rows)
    if (insErr) throw new Error(`${table} insert: ${insErr.message}`)
    rowsInserted[domain] = rows.length
    sectionsApplied.push(domain)
  }

  const result: TaxApplyResult = {
    targetYear,
    appliedAt: new Date().toISOString(),
    appliedBy,
    sections: sectionsApplied,
    rowsInserted,
    rowsDeleted,
  }

  await appendAuditLog(admin, result)
  return result
}
