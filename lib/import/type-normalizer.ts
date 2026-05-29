/** Map human-readable import labels to canonical DB slugs (case-insensitive). */

export const ASSET_TYPE_ALIASES: Record<string, string> = {
  'brokerage account': 'taxable_brokerage',
  brokerage: 'taxable_brokerage',
  'taxable brokerage': 'taxable_brokerage',
  'individual account': 'taxable_brokerage',
  'fidelity brokerage account': 'taxable_brokerage',
  'fidelity account': 'taxable_brokerage',
  'schwab one account': 'taxable_brokerage',
  'schwab brokerage': 'taxable_brokerage',
  'vanguard brokerage account': 'taxable_brokerage',
  'vanguard individual': 'taxable_brokerage',
  '401(k)': 'traditional_401k',
  '401k': 'traditional_401k',
  'traditional 401k': 'traditional_401k',
  'traditional 401(k)': 'traditional_401k',
  'roth 401(k)': 'roth_401k',
  'roth 401k': 'roth_401k',
  'traditional ira': 'traditional_ira',
  ira: 'traditional_ira',
  'roth ira': 'roth_ira',
  'sep ira': 'sep_ira',
  'simple ira': 'simple_ira',
  '403(b)': 'plan_403b',
  '403b': 'plan_403b',
  'real estate': 'real_estate',
  'rental property': 'real_estate',
  'investment property': 'real_estate',
  checking: 'checking_account',
  'checking account': 'checking_account',
  savings: 'savings_account',
  'savings account': 'savings_account',
  'money market': 'money_market',
  cd: 'certificate_of_deposit',
  'certificate of deposit': 'certificate_of_deposit',
  hsa: 'hsa',
  'health savings account': 'hsa',
  annuity: 'annuity',
  'life insurance': 'life_insurance',
  'cash value life insurance': 'life_insurance',
  'business interest': 'business',
  'private equity': 'private_equity',
  stock: 'individual_stock',
  'individual stock': 'individual_stock',
  crypto: 'cryptocurrency',
  cryptocurrency: 'cryptocurrency',
  'primary residence': 'primary_residence',
  'primary home': 'primary_residence',
  'primary_residence': 'primary_residence',
  'taxable_brokerage': 'taxable_brokerage',
  'traditional_401k': 'traditional_401k',
  'roth_401k': 'roth_401k',
  'traditional_ira': 'traditional_ira',
  'roth_ira': 'roth_ira',
  'sep_ira': 'sep_ira',
  'simple_ira': 'simple_ira',
  'plan_403b': 'plan_403b',
  'checking_account': 'checking_account',
  'savings_account': 'savings_account',
  'money_market': 'money_market',
  'certificate_of_deposit': 'certificate_of_deposit',
  'individual_stock': 'individual_stock',
}

export const LIABILITY_TYPE_ALIASES: Record<string, string> = {
  mortgage: 'mortgage',
  'home loan': 'mortgage',
  heloc: 'heloc',
  'home equity line': 'heloc',
  'home equity line of credit': 'heloc',
  'home equity loan': 'home_equity_loan',
  'auto loan': 'auto_loan',
  'car loan': 'auto_loan',
  'student loan': 'student_loan',
  'credit card': 'credit_card',
  'personal loan': 'personal_loan',
  'business loan': 'business_loan',
  'margin loan': 'margin_loan',
  'tax liability': 'tax_liability',
  'home_equity_loan': 'home_equity_loan',
  'auto_loan': 'auto_loan',
  'student_loan': 'student_loan',
  'credit_card': 'credit_card',
  'personal_loan': 'personal_loan',
  'business_loan': 'business_loan',
  'margin_loan': 'margin_loan',
  'tax_liability': 'tax_liability',
}

export const PROPERTY_TYPE_ALIASES: Record<string, string> = {
  'primary home': 'primary_residence',
  'primary residence': 'primary_residence',
  'primary_residence': 'primary_residence',
  residence: 'primary_residence',
  'vacation home': 'vacation',
  'second home': 'vacation',
  vacation: 'vacation',
  rental: 'rental',
  'investment property': 'rental',
  'rental property': 'rental',
  commercial: 'commercial',
  'commercial property': 'commercial',
  land: 'commercial',
}

export const CANONICAL_ASSET_TYPES = [
  ...new Set(Object.values(ASSET_TYPE_ALIASES)),
].sort()

export const CANONICAL_LIABILITY_TYPES = [
  ...new Set(Object.values(LIABILITY_TYPE_ALIASES)),
].sort()

export const CANONICAL_PROPERTY_TYPES = [
  'primary_residence',
  'rental',
  'vacation',
  'commercial',
] as const

export type NormalizeResult = {
  canonical: string | null
  matched: boolean
  displayLabel: string
}

function toDisplayLabel(slug: string): string {
  return slug
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function normalizeFromAliases(
  raw: string,
  aliases: Record<string, string>,
): NormalizeResult {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { canonical: null, matched: false, displayLabel: raw }
  }
  const key = trimmed.toLowerCase()
  const canonical = aliases[key] ?? null
  if (canonical) {
    return { canonical, matched: true, displayLabel: toDisplayLabel(canonical) }
  }
  return { canonical: null, matched: false, displayLabel: trimmed }
}

export function normalizeAssetType(raw: string): NormalizeResult {
  return normalizeFromAliases(raw, ASSET_TYPE_ALIASES)
}

export function normalizeLiabilityType(raw: string): NormalizeResult {
  return normalizeFromAliases(raw, LIABILITY_TYPE_ALIASES)
}

export function normalizePropertyType(raw: string): NormalizeResult {
  return normalizeFromAliases(raw, PROPERTY_TYPE_ALIASES)
}
