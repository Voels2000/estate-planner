import type { ProfileSavePayload } from '@/lib/profile/buildHouseholdPayload'

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
  deduction_mode?: string | null
  custom_deduction_amount?: number | null
}

type ProfileRow = {
  full_name?: string | null
  email?: string | null
}

/** Build a ProfileSavePayload from household + profile for inline PATCH prompts. */
export function buildProfileInlinePayload(
  household: HouseholdRow,
  profile: ProfileRow,
): ProfileSavePayload {
  return {
    householdId: household.id,
    fullName: profile.full_name ?? '',
    email: profile.email ?? '',
    householdName: household.name ?? '',
    person1Name: household.person1_name ?? '',
    person1BirthYear: household.person1_birth_year?.toString() ?? '',
    person1RetirementAge: household.person1_retirement_age?.toString() ?? '',
    person1SSClaimingAge: household.person1_ss_claiming_age?.toString() ?? '',
    person1LongevityAge: household.person1_longevity_age?.toString() ?? '',
    person1SSPia: household.person1_ss_pia?.toString() ?? '',
    hasSpouse: household.has_spouse === true,
    person2Name: household.person2_name ?? '',
    person2BirthYear: household.person2_birth_year?.toString() ?? '',
    person2RetirementAge: household.person2_retirement_age?.toString() ?? '',
    person2SSClaimingAge: household.person2_ss_claiming_age?.toString() ?? '',
    person2LongevityAge: household.person2_longevity_age?.toString() ?? '',
    person2SSPia: household.person2_ss_pia?.toString() ?? '',
    filingStatus: household.filing_status ?? 'single',
    statePrimary: household.state_primary ?? '',
    stateCompare: household.state_compare ?? '',
    deductionMode:
      household.deduction_mode === 'custom' || household.deduction_mode === 'none'
        ? household.deduction_mode
        : 'standard',
    customDeductionAmount: household.custom_deduction_amount?.toString() ?? '',
  }
}
