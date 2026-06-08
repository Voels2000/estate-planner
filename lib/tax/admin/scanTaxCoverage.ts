import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateStateEstateTax,
  MODELED_INHERITANCE_TAX_STATES,
  stateHasEstateTax,
} from '@/lib/calculations/stateEstateTax'
import { calculateStateIncomeTax } from '@/lib/calculations/stateIncomeTax'
import { calculateInheritanceTax } from '@/lib/projection/stateRegistry'
import { normalizeFilingStatus, NO_INCOME_TAX, MODELED_ESTATE, US_STATES } from '@/lib/tax/admin/usStates'
import type { TaxDomain, TaxScanIssue, TaxScanResult } from '@/lib/tax/admin/types'

function issue(
  id: string,
  domain: TaxDomain,
  severity: TaxScanIssue['severity'],
  message: string,
  detail?: string,
): TaxScanIssue {
  return { id, domain, severity, message, detail }
}

function emptySummary(): TaxScanResult['summary'] {
  return {
    federal_tax_config: { rowCount: 0, complete: false },
    federal_estate_tax_brackets: { rowCount: 0, complete: false },
    federal_tax_brackets: { rowCount: 0, complete: false },
    state_estate_tax_rules: { rowCount: 0, complete: false },
    state_income_tax_brackets: { rowCount: 0, complete: false },
    state_inheritance_tax_rules: { rowCount: 0, complete: false },
    irmaa_brackets: { rowCount: 0, complete: false },
  }
}

export async function scanTaxCoverage(
  admin: SupabaseClient,
  taxYear: number,
): Promise<TaxScanResult> {
  const issues: TaxScanIssue[] = []
  const summary = emptySummary()

  const { count: fedConfigCount } = await admin
    .from('federal_tax_config')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
  summary.federal_tax_config.rowCount = fedConfigCount ?? 0
  summary.federal_tax_config.complete = (fedConfigCount ?? 0) > 0
  if (!summary.federal_tax_config.complete) {
    issues.push(
      issue(
        'fed-config-missing',
        'federal_tax_config',
        'error',
        'No active federal_tax_config row — estate/gift projections use fallbacks.',
      ),
    )
  }

  const { data: fedEstate } = await admin
    .from('federal_estate_tax_brackets')
    .select('id')
    .eq('tax_year', taxYear)
  summary.federal_estate_tax_brackets.rowCount = fedEstate?.length ?? 0
  summary.federal_estate_tax_brackets.complete = (fedEstate?.length ?? 0) > 0
  if (!summary.federal_estate_tax_brackets.complete) {
    issues.push(
      issue(
        'fed-estate-missing',
        'federal_estate_tax_brackets',
        'error',
        `No federal estate tax brackets for ${taxYear}.`,
      ),
    )
  }

  const { data: fedIncome } = await admin
    .from('federal_tax_brackets')
    .select('filing_status, tax_year')
    .eq('tax_year', taxYear)
  summary.federal_tax_brackets.rowCount = fedIncome?.length ?? 0
  const fedStatuses = new Set(
    (fedIncome ?? []).map((r) => normalizeFilingStatus(String(r.filing_status ?? ''))).filter(Boolean),
  )
  const fedIncomeComplete = fedStatuses.has('single') && fedStatuses.has('mfj')
  summary.federal_tax_brackets.complete = fedIncomeComplete
  if (!fedIncomeComplete) {
    issues.push(
      issue(
        'fed-income-incomplete',
        'federal_tax_brackets',
        'error',
        `Federal income brackets for ${taxYear} incomplete (single: ${fedStatuses.has('single') ? 'yes' : 'no'}, MFJ: ${fedStatuses.has('mfj') ? 'yes' : 'no'}).`,
      ),
    )
  }

  const { data: irmaa } = await admin.from('irmaa_brackets').select('id').eq('tax_year', taxYear)
  summary.irmaa_brackets.rowCount = irmaa?.length ?? 0
  summary.irmaa_brackets.complete = (irmaa?.length ?? 0) > 0
  if (!summary.irmaa_brackets.complete) {
    issues.push(
      issue(
        'irmaa-missing',
        'irmaa_brackets',
        'warn',
        `No IRMAA brackets for ${taxYear}.`,
      ),
    )
  }

  const { data: estateRows } = await admin
    .from('state_estate_tax_rules')
    .select('state, min_amount, max_amount, rate_pct, exemption_amount')
    .eq('tax_year', taxYear)

  const estateByState = new Map<string, typeof estateRows>()
  for (const row of estateRows ?? []) {
    const list = estateByState.get(row.state) ?? []
    list.push(row)
    estateByState.set(row.state, list)
  }

  let estateComplete = true
  for (const state of MODELED_ESTATE) {
    const brackets = (estateByState.get(state) ?? []).map((r) => ({
      min_amount: Number(r.min_amount ?? 0),
      max_amount: Number(r.max_amount ?? 9_999_999_999),
      rate_pct: Number(r.rate_pct ?? 0),
      exemption_amount: Number(r.exemption_amount ?? 0),
    }))
    const needsRules = stateHasEstateTax(state)
    const ok =
      !needsRules ||
      (brackets.length > 0 &&
        calculateStateEstateTax(25_000_000, state, brackets, true).stateTax >= 0)
    if (!ok) {
      estateComplete = false
      issues.push(
        issue(
          `estate-${state}`,
          'state_estate_tax_rules',
          'error',
          `${state} estate tax rules missing or invalid for ${taxYear}.`,
        ),
      )
    }
  }
  summary.state_estate_tax_rules.rowCount = estateRows?.length ?? 0
  summary.state_estate_tax_rules.complete = estateComplete

  const { data: incomeRows } = await admin
    .from('state_income_tax_brackets')
    .select('state, tax_year, filing_status, min_amount, max_amount, rate_pct')
    .eq('tax_year', taxYear)

  const incomeByState = new Map<string, Set<string>>()
  for (const row of incomeRows ?? []) {
    const state = String(row.state ?? '').toUpperCase()
    if (!state || NO_INCOME_TAX.has(state)) continue
    const fs = normalizeFilingStatus(String(row.filing_status ?? ''))
    if (!fs) continue
    if (!incomeByState.has(state)) incomeByState.set(state, new Set())
    incomeByState.get(state)!.add(fs)
  }

  const requiredIncomeStates = US_STATES.filter((s) => !NO_INCOME_TAX.has(s))
  let incomeComplete = true
  for (const state of requiredIncomeStates) {
    const statuses = incomeByState.get(state)
    if (!statuses?.has('single') || !statuses.has('mfj')) {
      incomeComplete = false
      issues.push(
        issue(
          `income-${state}`,
          'state_income_tax_brackets',
          'error',
          `${state} income brackets for ${taxYear} missing single and/or MFJ.`,
        ),
      )
    }
  }

  const caBrackets = (incomeRows ?? [])
    .filter((r) => r.state === 'CA')
    .map((r) => ({
      state: r.state,
      tax_year: r.tax_year,
      filing_status: r.filing_status as 'single' | 'mfj',
      min_amount: Number(r.min_amount),
      max_amount: r.max_amount != null ? Number(r.max_amount) : null,
      rate_pct: Number(r.rate_pct),
    }))
  if (caBrackets.length > 0) {
    const caTax = calculateStateIncomeTax({
      stateCode: 'CA',
      ordinaryIncome: 250_000,
      filingStatus: 'single',
      brackets: caBrackets,
      taxYear,
    }).stateTax
    if (caTax <= 0) {
      incomeComplete = false
      issues.push(
        issue(
          'income-ca-sample',
          'state_income_tax_brackets',
          'error',
          `CA sample tax on $250k single returned $${caTax} — bracket data may be corrupt.`,
        ),
      )
    }
  }

  summary.state_income_tax_brackets.rowCount = incomeRows?.length ?? 0
  summary.state_income_tax_brackets.complete = incomeComplete

  const { data: inheritRows } = await admin
    .from('state_inheritance_tax_rules')
    .select('state')
    .eq('tax_year', taxYear)
  const inheritStates = [...new Set((inheritRows ?? []).map((r) => r.state))].sort()
  summary.state_inheritance_tax_rules.rowCount = inheritRows?.length ?? 0
  const inheritMatch =
    inheritStates.length === MODELED_INHERITANCE_TAX_STATES.length &&
    inheritStates.every((s, i) => s === MODELED_INHERITANCE_TAX_STATES[i])
  summary.state_inheritance_tax_rules.complete = inheritMatch
  if (!inheritMatch) {
    issues.push(
      issue(
        'inherit-states',
        'state_inheritance_tax_rules',
        'error',
        `Inheritance DB states [${inheritStates.join(', ')}] do not match modeled list [${MODELED_INHERITANCE_TAX_STATES.join(', ')}].`,
      ),
    )
  }

  for (const state of MODELED_INHERITANCE_TAX_STATES) {
    const result = calculateInheritanceTax({
      state: state as 'PA',
      beneficiaryType: 'other',
      inheritanceAmount: 100_000,
      year: taxYear,
    })
    if (result.taxDue < 0) {
      summary.state_inheritance_tax_rules.complete = false
      issues.push(
        issue(
          `inherit-calc-${state}`,
          'state_inheritance_tax_rules',
          'error',
          `${state} inheritance calculation failed for ${taxYear}.`,
        ),
      )
    }
  }

  const errors = issues.filter((i) => i.severity === 'error')
  return {
    taxYear,
    scannedAt: new Date().toISOString(),
    ok: errors.length === 0,
    issues,
    summary,
  }
}
