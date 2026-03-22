
export type InsuranceType = 'life' | 'disability' | 'ltc' | 'property_casualty'
export type LifeSubtype = 'term' | 'whole' | 'universal' | 'variable'
export type BenefitPeriod = '2yr' | '5yr' | 'to65' | 'lifetime'

export interface InsurancePolicy {
  id: string
  user_id: string
  insurance_type: InsuranceType
  provider?: string
  policy_name?: string
  policy_number?: string
  coverage_amount?: number
  monthly_premium?: number
  annual_premium?: number
  term_years?: number
  expiration_date?: string
  is_employer_provided?: boolean
  covered_members?: string[]
  policy_subtype?: LifeSubtype
  cash_value?: number
  death_benefit?: number
  monthly_benefit?: number
  elimination_days?: number
  benefit_period?: BenefitPeriod
  daily_benefit?: number
  ltc_benefit_period?: string
  inflation_protection?: boolean
  property_type?: string
  deductible?: number
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface HouseholdProfile {
  annual_income: number
  age: number
  spouse_age?: number
  dependents: number
  total_assets: number
  total_debts: number
  monthly_expenses: number
  has_spouse: boolean
}

export interface InsuranceGapResult {
  type: InsuranceType
  label: string
  recommended: number
  current: number
  gap: number
  gap_pct: number
  status: 'adequate' | 'gap' | 'over'
  unit: string
  insight: string
}

export function calcLifeGap(profile: HouseholdProfile, policies: InsurancePolicy[]): InsuranceGapResult {
  // DIME method: Debt + Income (10x) + Mortgage + Education
  const recommended = profile.total_debts + (profile.annual_income * 10)
  const current = policies
    .filter(p => p.insurance_type === 'life')
    .reduce((sum, p) => sum + (p.death_benefit || p.coverage_amount || 0), 0)
  const gap = Math.max(0, recommended - current)
  const status = current >= recommended ? 'adequate' : current >= recommended * 0.8 ? 'gap' : 'gap'

  return {
    type: 'life',
    label: 'Life Insurance',
    recommended,
    current,
    gap,
    gap_pct: recommended > 0 ? Math.round((current / recommended) * 100) : 0,
    status: current >= recommended ? 'adequate' : 'gap',
    unit: '$',
    insight: current >= recommended
      ? 'Your life insurance coverage meets the recommended 10x income + debts threshold.'
      : `You are underinsured by ${formatCurrency(gap)}. Consider a term life policy to close this gap.`,
  }
}

export function calcDisabilityGap(profile: HouseholdProfile, policies: InsurancePolicy[]): InsuranceGapResult {
  // Recommended: 60% of gross monthly income
  const recommended = Math.round((profile.annual_income / 12) * 0.6)
  const current = policies
    .filter(p => p.insurance_type === 'disability')
    .reduce((sum, p) => sum + (p.monthly_benefit || 0), 0)
  const gap = Math.max(0, recommended - current)

  return {
    type: 'disability',
    label: 'Disability Insurance',
    recommended,
    current,
    gap,
    gap_pct: recommended > 0 ? Math.round((current / recommended) * 100) : 0,
    status: current >= recommended ? 'adequate' : 'gap',
    unit: '$/mo',
    insight: current >= recommended
      ? 'Your disability coverage meets the recommended 60% income replacement benchmark.'
      : `You are short ${formatCurrency(gap)}/mo. Disability is the most underinsured risk for working adults.`,
  }
}

export function calcLTCGap(profile: HouseholdProfile, policies: InsurancePolicy[]): InsuranceGapResult {
  // Recommended: $200/day (national median facility cost); relevant 55+
  const recommended = profile.age >= 55 ? 200 : 0
  const current = policies
    .filter(p => p.insurance_type === 'ltc')
    .reduce((sum, p) => sum + (p.daily_benefit || 0), 0)
  const gap = Math.max(0, recommended - current)

  return {
    type: 'ltc',
    label: 'Long-Term Care',
    recommended,
    current,
    gap,
    gap_pct: recommended > 0 ? Math.round((current / recommended) * 100) : 100,
    status: profile.age < 55 ? 'adequate' : current >= recommended ? 'adequate' : 'gap',
    unit: '$/day',
    insight: profile.age < 55
      ? 'LTC insurance is typically most cost-effective to purchase between ages 55–65.'
      : current >= recommended
        ? 'Your LTC daily benefit meets the national median facility cost benchmark.'
        : `You are short $${gap}/day. At median costs, a 3-year stay could cost $219,000+.`,
  }
}

export function calcPCGap(profile: HouseholdProfile, policies: InsurancePolicy[]): InsuranceGapResult {
  const hasHome = policies.some(p => p.insurance_type === 'property_casualty' && p.property_type === 'home')
  const hasAuto = policies.some(p => p.insurance_type === 'property_casualty' && p.property_type === 'auto')
  const hasUmbrella = policies.some(p => p.insurance_type === 'property_casualty' && p.property_type === 'umbrella')

  const needed = 2 + (profile.has_spouse ? 1 : 0) // home + auto + umbrella if assets > 500k
  const needsUmbrella = profile.total_assets > 500000
  const current = [hasHome, hasAuto, hasUmbrella && needsUmbrella].filter(Boolean).length
  const recommended = needsUmbrella ? 3 : 2

  return {
    type: 'property_casualty',
    label: 'Property & Casualty',
    recommended,
    current,
    gap: Math.max(0, recommended - current),
    gap_pct: Math.round((current / recommended) * 100),
    status: current >= recommended ? 'adequate' : 'gap',
    unit: 'policies',
    insight: current >= recommended
      ? 'Your P&C coverage appears complete for your asset level.'
      : !hasHome
        ? 'Missing homeowners/renters insurance — this is a critical gap.'
        : !hasAuto
          ? 'Missing auto insurance — required in most states.'
          : needsUmbrella && !hasUmbrella
            ? 'With $500k+ in assets, an umbrella policy ($1M coverage ~$200/yr) is strongly recommended.'
            : 'Review your P&C coverage to ensure it matches cnt asset values.',
  }
}

export function analyzeGaps(profile: HouseholdProfile, policies: InsurancePolicy[]): InsuranceGapResult[] {
  return [
    calcLifeGap(profile, policies),
    calcDisabilityGap(profile, policies),
    calcLTCGap(profile, policies),
    calcPCGap(profile, policies),
  ]
}

export function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}
