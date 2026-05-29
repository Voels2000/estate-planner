import type { ProfileSavePayload } from '@/lib/profile/buildHouseholdPayload'

/** Field definition for ProfileFieldPrompt — payloadKey maps to PATCH /api/consumer/profile. */
export type ProfileFieldDef = {
  name: string
  payloadKey: keyof ProfileSavePayload
  label: string
  type: 'number' | 'select'
  placeholder?: string
  helpText?: string
  options?: { value: string; label: string }[]
  min?: number
  max?: number
}

export type HouseholdPromptSource = {
  person1_birth_year?: number | null
  person1_ss_claiming_age?: number | null
  person1_ss_pia?: number | null
  person1_retirement_age?: number | null
  person1_longevity_age?: number | null
  has_spouse?: boolean | null
  person2_ss_claiming_age?: number | null
  person2_ss_pia?: number | null
  person2_retirement_age?: number | null
  person2_longevity_age?: number | null
  /** null/unset only — 'standard' is an explicit user choice and must not re-prompt */
  deduction_mode?: string | null
}

export const SS_FIELDS_PERSON_1: ProfileFieldDef[] = [
  {
    name: 'person1_ss_claiming_age',
    payloadKey: 'person1SSClaimingAge',
    label: 'Planned claiming age',
    type: 'number',
    placeholder: '62–70',
    min: 62,
    max: 70,
    helpText: 'Age at which you plan to start Social Security benefits.',
  },
  {
    name: 'person1_ss_pia',
    payloadKey: 'person1SSPia',
    label: 'Estimated monthly benefit (PIA)',
    type: 'number',
    placeholder: 'e.g. 2800',
    helpText:
      'Your Primary Insurance Amount at full retirement age. Find this at ssa.gov/myaccount.',
  },
]

export const SS_FIELDS_PERSON_2: ProfileFieldDef[] = [
  {
    name: 'person2_ss_claiming_age',
    payloadKey: 'person2SSClaimingAge',
    label: 'Planned claiming age',
    type: 'number',
    placeholder: '62–70',
    min: 62,
    max: 70,
  },
  {
    name: 'person2_ss_pia',
    payloadKey: 'person2SSPia',
    label: 'Estimated monthly benefit (PIA)',
    type: 'number',
    placeholder: 'e.g. 2800',
    helpText: 'Find this at ssa.gov/myaccount.',
  },
]

export function ssFieldsForPerson1(household: HouseholdPromptSource): ProfileFieldDef[] {
  return SS_FIELDS_PERSON_1.filter((field) => {
    if (field.name === 'person1_ss_claiming_age') return !household.person1_ss_claiming_age
    if (field.name === 'person1_ss_pia') return !household.person1_ss_pia
    return true
  })
}

export function ssFieldsForPerson2(household: HouseholdPromptSource): ProfileFieldDef[] {
  return SS_FIELDS_PERSON_2.filter((field) => {
    if (field.name === 'person2_ss_claiming_age') return !household.person2_ss_claiming_age
    if (field.name === 'person2_ss_pia') return !household.person2_ss_pia
    return true
  })
}

export function needsSsPerson1(household: HouseholdPromptSource): boolean {
  return !household.person1_ss_claiming_age || !household.person1_ss_pia
}

export function needsSsPerson2(household: HouseholdPromptSource): boolean {
  return (
    household.has_spouse === true &&
    (!household.person2_ss_claiming_age || !household.person2_ss_pia)
  )
}

/** Deduction prompt only when column is null/unset — not when user chose standard explicitly. */
export function needsDeductionMode(household: HouseholdPromptSource): boolean {
  return household.deduction_mode == null || household.deduction_mode === ''
}

export function buildScenariosPlanningFields(household: HouseholdPromptSource): ProfileFieldDef[] {
  const fields: ProfileFieldDef[] = []
  const hasSpouse = household.has_spouse === true

  if (!household.person1_retirement_age) {
    fields.push({
      name: 'person1_retirement_age',
      payloadKey: 'person1RetirementAge',
      label: 'Your planned retirement age',
      type: 'number',
      placeholder: 'e.g. 65',
      min: 50,
      max: 80,
    })
  }
  if (hasSpouse && !household.person2_retirement_age) {
    fields.push({
      name: 'person2_retirement_age',
      payloadKey: 'person2RetirementAge',
      label: "Spouse / partner's planned retirement age",
      type: 'number',
      placeholder: 'e.g. 63',
      min: 50,
      max: 80,
    })
  }

  if (!household.person1_longevity_age) {
    fields.push({
      name: 'person1_longevity_age',
      payloadKey: 'person1LongevityAge',
      label: 'Planning horizon age (you)',
      type: 'number',
      placeholder: 'e.g. 90',
      min: 70,
      max: 100,
      helpText:
        'Age through which the projection models your plan. Often 90–95 for conservative planning.',
    })
  }
  if (hasSpouse && !household.person2_longevity_age) {
    fields.push({
      name: 'person2_longevity_age',
      payloadKey: 'person2LongevityAge',
      label: 'Planning horizon age (spouse / partner)',
      type: 'number',
      placeholder: 'e.g. 92',
      min: 70,
      max: 100,
    })
  }

  if (needsDeductionMode(household)) {
    fields.push({
      name: 'deduction_mode',
      payloadKey: 'deductionMode',
      label: 'Federal income tax deduction method',
      type: 'select',
      options: [
        { value: 'standard', label: 'Standard deduction' },
        { value: 'none', label: 'No deduction ($0)' },
        { value: 'custom', label: 'Custom amount' },
      ],
      helpText:
        'Used in the income tax projection. Most households use standard; choose custom for a specific annual deduction.',
    })
  }

  return fields
}

/** Inline prompts on `/projections` for birth year and retirement age only. */
export function buildProjectionPlanningFields(household: HouseholdPromptSource): ProfileFieldDef[] {
  const fields: ProfileFieldDef[] = []

  if (!household.person1_birth_year) {
    fields.push({
      name: 'person1_birth_year',
      payloadKey: 'person1BirthYear',
      label: 'Your birth year',
      type: 'number',
      placeholder: '1965',
      min: 1900,
      max: 2100,
      helpText: 'Required for retirement timeline calculations',
    })
  }
  if (!household.person1_retirement_age) {
    fields.push({
      name: 'person1_retirement_age',
      payloadKey: 'person1RetirementAge',
      label: 'Target retirement age',
      type: 'number',
      placeholder: '65',
      min: 50,
      max: 80,
      helpText: 'The age you plan to retire',
    })
  }

  return fields
}
