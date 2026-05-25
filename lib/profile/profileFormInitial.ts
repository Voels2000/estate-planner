export const FILING_STATUSES = ['single', 'mfj', 'mfs', 'hoh', 'qw'] as const

export type ProfileFormInitial = {
  householdId: string | null
  fullName: string
  email: string
  householdName: string
  person1Name: string
  person1BirthYear: string
  person1RetirementAge: string
  person1SSClaimingAge: string
  person1LongevityAge: string
  person1SSPia: string
  hasSpouse: boolean
  person2Name: string
  person2BirthYear: string
  person2RetirementAge: string
  person2SSClaimingAge: string
  person2LongevityAge: string
  person2SSPia: string
  filingStatus: string
  statePrimary: string
  stateCompare: string
  inflationRate: string
  riskTolerance: string
  growthRateAccumulation: string
  growthRateRetirement: string
  deductionMode: 'standard' | 'custom' | 'none'
  customDeductionAmount: string
  grossEstateEstimate: string
  hasMinorChildren: boolean | null
  hasBusinessInterests: boolean | null
  showWizardFields: boolean
}

type HouseholdRow = {
  id: string
  name?: string | null
  person1_name?: string | null
  person1_birth_year?: number | null
  person1_retirement_age?: number | null
  person1_ss_claiming_age?: number | null
  person1_longevity_age?: number | null
  person1_ss_pia?: number | null
  has_spouse?: boolean | null
  person2_name?: string | null
  person2_birth_year?: number | null
  person2_retirement_age?: number | null
  person2_ss_claiming_age?: number | null
  person2_longevity_age?: number | null
  person2_ss_pia?: number | null
  filing_status?: string | null
  state_primary?: string | null
  state_compare?: string | null
  inflation_rate?: number | null
  risk_tolerance?: string | null
  growth_rate_accumulation?: number | null
  growth_rate_retirement?: number | null
  deduction_mode?: string | null
  custom_deduction_amount?: number | null
  person1_first_name?: string | null
  person2_first_name?: string | null
  gross_estate_estimate?: string | null
  has_minor_children?: boolean | null
  has_business_interests?: boolean | null
}

export function buildProfileFormInitial(
  profile: {
    full_name?: string | null
    email?: string | null
    onboarding_wizard_completed_at?: string | null
  } | null,
  household: HouseholdRow | null,
  userEmail: string,
): ProfileFormInitial {
  const fs = household?.filing_status
  const filingStatus = fs && FILING_STATUSES.includes(fs as (typeof FILING_STATUSES)[number]) ? fs : 'single'
  const deductionMode = household?.deduction_mode
  const validDeduction =
    deductionMode === 'standard' || deductionMode === 'custom' || deductionMode === 'none'
      ? deductionMode
      : 'standard'

  return {
    householdId: household?.id ?? null,
    fullName: profile?.full_name ?? '',
    email: profile?.email ?? userEmail,
    householdName: household?.name ?? '',
    person1Name: household?.person1_name ?? '',
    person1BirthYear: household?.person1_birth_year?.toString() ?? '',
    person1RetirementAge: household?.person1_retirement_age?.toString() ?? '',
    person1SSClaimingAge: household?.person1_ss_claiming_age?.toString() ?? '',
    person1LongevityAge: household?.person1_longevity_age?.toString() ?? '',
    person1SSPia: household?.person1_ss_pia?.toString() ?? '',
    hasSpouse: household?.has_spouse ?? false,
    person2Name: household?.person2_name ?? '',
    person2BirthYear: household?.person2_birth_year?.toString() ?? '',
    person2RetirementAge: household?.person2_retirement_age?.toString() ?? '',
    person2SSClaimingAge: household?.person2_ss_claiming_age?.toString() ?? '',
    person2LongevityAge: household?.person2_longevity_age?.toString() ?? '',
    person2SSPia: household?.person2_ss_pia?.toString() ?? '',
    filingStatus,
    statePrimary: household?.state_primary ?? '',
    stateCompare: household?.state_compare ?? '',
    inflationRate: household?.inflation_rate?.toString() ?? '2.5',
    riskTolerance: household?.risk_tolerance ?? 'moderate',
    growthRateAccumulation: household?.growth_rate_accumulation?.toString() ?? '7',
    growthRateRetirement: household?.growth_rate_retirement?.toString() ?? '5',
    deductionMode: validDeduction,
    customDeductionAmount: household?.custom_deduction_amount?.toString() ?? '',
    grossEstateEstimate: household?.gross_estate_estimate ?? '',
    hasMinorChildren: household?.has_minor_children ?? null,
    hasBusinessInterests: household?.has_business_interests ?? null,
    showWizardFields: !profile?.onboarding_wizard_completed_at,
  }
}
