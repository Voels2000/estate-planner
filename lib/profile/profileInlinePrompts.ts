import type { ProfileInlineField } from '@/components/profile/ProfileIncompleteInlinePrompt'

type HouseholdPromptSource = {
  person1_ss_claiming_age?: number | null
  person1_ss_pia?: number | null
  person1_retirement_age?: number | null
  person1_longevity_age?: number | null
  has_spouse?: boolean | null
  person2_ss_claiming_age?: number | null
  person2_ss_pia?: number | null
  person2_retirement_age?: number | null
  person2_longevity_age?: number | null
  deduction_mode?: string | null
}

export function socialSecurityInlineFields(
  household: HouseholdPromptSource,
): ProfileInlineField[] {
  const fields: ProfileInlineField[] = []

  if (!household.person1_ss_claiming_age) {
    fields.push({
      key: 'person1_ss_claiming_age',
      label: 'Your Social Security claiming age',
      type: 'number',
      min: 62,
      max: 70,
      placeholder: '67',
      patch: (value) => ({ person1SSClaimingAge: value }),
    })
  }
  if (!household.person1_ss_pia) {
    fields.push({
      key: 'person1_ss_pia',
      label: 'Your monthly SS benefit at full retirement age (PIA)',
      type: 'number',
      min: 0,
      placeholder: '2400',
      patch: (value) => ({ person1SSPia: value }),
    })
  }
  if (household.has_spouse && !household.person2_ss_claiming_age) {
    fields.push({
      key: 'person2_ss_claiming_age',
      label: 'Spouse SS claiming age',
      type: 'number',
      min: 62,
      max: 70,
      placeholder: '67',
      patch: (value) => ({ person2SSClaimingAge: value }),
    })
  }
  if (household.has_spouse && !household.person2_ss_pia) {
    fields.push({
      key: 'person2_ss_pia',
      label: 'Spouse monthly SS benefit (PIA)',
      type: 'number',
      min: 0,
      placeholder: '1800',
      patch: (value) => ({ person2SSPia: value }),
    })
  }

  return fields
}

export function scenariosInlineFields(household: HouseholdPromptSource): ProfileInlineField[] {
  const fields: ProfileInlineField[] = []

  if (!household.person1_retirement_age) {
    fields.push({
      key: 'person1_retirement_age',
      label: 'Your retirement age',
      type: 'number',
      min: 50,
      max: 80,
      placeholder: '65',
      patch: (value) => ({ person1RetirementAge: value }),
    })
  }
  if (!household.person1_longevity_age) {
    fields.push({
      key: 'person1_longevity_age',
      label: 'Your longevity age (life expectancy)',
      type: 'number',
      min: 70,
      max: 110,
      placeholder: '90',
      patch: (value) => ({ person1LongevityAge: value }),
    })
  }
  if (household.has_spouse && !household.person2_retirement_age) {
    fields.push({
      key: 'person2_retirement_age',
      label: 'Spouse retirement age',
      type: 'number',
      min: 50,
      max: 80,
      placeholder: '65',
      patch: (value) => ({ person2RetirementAge: value }),
    })
  }
  if (household.has_spouse && !household.person2_longevity_age) {
    fields.push({
      key: 'person2_longevity_age',
      label: 'Spouse longevity age',
      type: 'number',
      min: 70,
      max: 110,
      placeholder: '88',
      patch: (value) => ({ person2LongevityAge: value }),
    })
  }
  if (!household.deduction_mode) {
    fields.push({
      key: 'deduction_mode',
      label: 'Tax deduction method',
      type: 'select',
      options: [
        { value: 'standard', label: 'Standard' },
        { value: 'custom', label: 'Custom' },
        { value: 'none', label: 'None' },
      ],
      patch: (value) => ({
        deductionMode: value as 'standard' | 'custom' | 'none',
      }),
    })
  }

  return fields
}
