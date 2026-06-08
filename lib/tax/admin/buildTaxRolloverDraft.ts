import type { SupabaseClient } from '@supabase/supabase-js'
import { getManualVerifyForYear } from '@/lib/tax/admin/manualVerifyConfig'
import type { TaxDomain, TaxRolloverDraft } from '@/lib/tax/admin/types'

const STRIP_KEYS = new Set(['id', 'created_at', 'updated_at'])

function stripRow<T extends Record<string, unknown>>(row: T, targetYear: number): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (STRIP_KEYS.has(k)) continue
    out[k] = k === 'tax_year' ? targetYear : v
  }
  if (!('tax_year' in out)) out.tax_year = targetYear
  return out
}

async function fetchSourceRows(
  admin: SupabaseClient,
  table: string,
  sourceYear: number,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await admin.from(table).select('*').eq('tax_year', sourceYear)
  if (error) throw new Error(`${table}: ${error.message}`)
  return (data ?? []) as Record<string, unknown>[]
}

async function targetYearHasRows(
  admin: SupabaseClient,
  table: string,
  targetYear: number,
): Promise<boolean> {
  const { count, error } = await admin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('tax_year', targetYear)
  if (error) throw new Error(`${table}: ${error.message}`)
  return (count ?? 0) > 0
}

async function federalBracketsTargetHasData(admin: SupabaseClient, targetYear: number): Promise<boolean> {
  const { count, error } = await admin
    .from('federal_tax_brackets')
    .select('*', { count: 'exact', head: true })
    .eq('tax_year', targetYear)
  if (error) throw new Error(`federal_tax_brackets: ${error.message}`)
  return (count ?? 0) > 0
}

export async function buildTaxRolloverDraft(
  admin: SupabaseClient,
  sourceYear: number,
  targetYear: number,
): Promise<TaxRolloverDraft> {
  if (targetYear <= sourceYear) {
    throw new Error('Target year must be greater than source year.')
  }

  const [
    federalEstate,
    federalIncome,
    stateEstate,
    stateIncome,
    inheritance,
    irmaa,
    hasStateEstate,
    hasStateIncome,
    hasInheritance,
    hasIrmaa,
    hasFedEstate,
    hasFedIncome,
  ] = await Promise.all([
    fetchSourceRows(admin, 'federal_estate_tax_brackets', sourceYear),
    fetchSourceRows(admin, 'federal_tax_brackets', sourceYear),
    fetchSourceRows(admin, 'state_estate_tax_rules', sourceYear),
    fetchSourceRows(admin, 'state_income_tax_brackets', sourceYear),
    fetchSourceRows(admin, 'state_inheritance_tax_rules', sourceYear),
    fetchSourceRows(admin, 'irmaa_brackets', sourceYear),
    targetYearHasRows(admin, 'state_estate_tax_rules', targetYear),
    targetYearHasRows(admin, 'state_income_tax_brackets', targetYear),
    targetYearHasRows(admin, 'state_inheritance_tax_rules', targetYear),
    targetYearHasRows(admin, 'irmaa_brackets', targetYear),
    targetYearHasRows(admin, 'federal_estate_tax_brackets', targetYear),
    federalBracketsTargetHasData(admin, targetYear),
  ])

  if (federalEstate.length === 0 && federalIncome.length === 0 && stateEstate.length === 0) {
    throw new Error(`No tax rule rows found for source year ${sourceYear}.`)
  }

  const manual = getManualVerifyForYear(targetYear)
  const payload = {
    federal_estate_tax_brackets: federalEstate.map((r) => stripRow(r, targetYear)),
    federal_tax_brackets: federalIncome.map((r) => stripRow(r, targetYear)),
    state_estate_tax_rules: stateEstate.map((r) => stripRow(r, targetYear)),
    state_income_tax_brackets: stateIncome.map((r) => stripRow(r, targetYear)),
    state_inheritance_tax_rules: inheritance.map((r) => stripRow(r, targetYear)),
    irmaa_brackets: irmaa.map((r) => stripRow(r, targetYear)),
  }

  const counts: Partial<Record<TaxDomain, number>> = {
    federal_estate_tax_brackets: payload.federal_estate_tax_brackets.length,
    federal_tax_brackets: payload.federal_tax_brackets.length,
    state_estate_tax_rules: payload.state_estate_tax_rules.length,
    state_income_tax_brackets: payload.state_income_tax_brackets.length,
    state_inheritance_tax_rules: payload.state_inheritance_tax_rules.length,
    irmaa_brackets: payload.irmaa_brackets.length,
  }

  return {
    sourceYear,
    targetYear,
    createdAt: new Date().toISOString(),
    manualVerify: {
      sections: manual.alwaysVerify,
      stateEstate: manual.stateEstate,
      stateIncome: manual.stateIncome,
      notes: manual.notes,
    },
    counts,
    payload,
    targetYearAlreadyHasData:
      hasStateEstate ||
      hasStateIncome ||
      hasInheritance ||
      hasIrmaa ||
      hasFedEstate ||
      hasFedIncome,
  }
}
