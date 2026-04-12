/** Normalizes life & estate insurance policy fields for POST/PATCH to `insurance_policies`. */

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

export function insurancePolicyRowForSave(input: Record<string, unknown>) {
  return {
    insurance_type: strOrNull(input.insurance_type),
    provider: strOrNull(input.provider),
    policy_name: strOrNull(input.policy_name),
    owner: strOrNull(input.owner),
    policy_number: strOrNull(input.policy_number),
    coverage_amount: num(input.coverage_amount),
    death_benefit: num(input.death_benefit),
    cash_value: num(input.cash_value),
    monthly_premium: num(input.monthly_premium),
    annual_premium: num(input.annual_premium),
    term_years: num(input.term_years),
    expiration_date: strOrNull(input.expiration_date),
    is_employer_provided: Boolean(input.is_employer_provided),
    is_ilit: Boolean(input.is_ilit),
    notes: strOrNull(input.notes),
  }
}
