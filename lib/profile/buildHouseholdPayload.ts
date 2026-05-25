import { FILING_STATUSES } from '@/lib/profile/profileFormInitial'

export type ProfileSavePayload = {
  householdId?: string | null
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
  person1FirstName?: string
  person2FirstName?: string
  grossEstateEstimate?: string
  hasMinorChildren?: boolean | null
  hasBusinessInterests?: boolean | null
}

const GROSS_ESTATE_ESTIMATE_VALUES = [
  'under_2m',
  '2m_5m',
  '5m_10m',
  '10m_20m',
  'over_20m',
] as const

export function validateProfileSavePayload(payload: ProfileSavePayload): string[] {
  const errors: string[] = []
  if (!payload.person1Name?.trim()) errors.push('Your name is required')
  if (!payload.person1BirthYear) errors.push('Your birth year is required')
  if (!payload.person1RetirementAge) errors.push('Your retirement age is required')
  if (!payload.person1SSClaimingAge) errors.push('Your Social Security claiming age is required')
  if (!payload.person1LongevityAge) errors.push('Your longevity age is required')
  if (payload.hasSpouse) {
    if (!payload.person2Name?.trim()) errors.push('Spouse name is required')
    if (!payload.person2BirthYear) errors.push('Spouse birth year is required')
    if (!payload.person2RetirementAge) errors.push('Spouse retirement age is required')
    if (!payload.person2SSClaimingAge) errors.push('Spouse Social Security claiming age is required')
    if (!payload.person2LongevityAge) errors.push('Spouse longevity age is required')
  }
  return errors
}

export function buildHouseholdRow(ownerId: string, payload: ProfileSavePayload) {
  const filingStatus = FILING_STATUSES.includes(
    payload.filingStatus as (typeof FILING_STATUSES)[number],
  )
    ? payload.filingStatus
    : 'single'

  return {
    owner_id: ownerId,
    name: payload.householdName || `${payload.fullName}'s Household`,
    person1_name: payload.person1Name,
    person1_first_name:
      payload.person1FirstName?.trim() ||
      payload.person1Name.trim().split(' ')[0] ||
      null,
    person1_last_name: payload.person1Name.trim().split(' ').slice(1).join(' ') || null,
    person1_birth_year: parseInt(payload.person1BirthYear, 10) || null,
    person1_retirement_age: parseInt(payload.person1RetirementAge, 10) || null,
    person1_ss_claiming_age: parseInt(payload.person1SSClaimingAge, 10) || null,
    person1_longevity_age: parseInt(payload.person1LongevityAge, 10) || null,
    person1_ss_pia: payload.person1SSPia.trim() !== '' ? Number(payload.person1SSPia) : null,
    has_spouse: payload.hasSpouse,
    person2_name: payload.hasSpouse ? payload.person2Name : null,
    person2_first_name: payload.hasSpouse
      ? payload.person2FirstName?.trim() ||
        payload.person2Name.trim().split(' ')[0] ||
        null
      : null,
    person2_last_name: payload.hasSpouse
      ? payload.person2Name.trim().split(' ').slice(1).join(' ') || null
      : null,
    person2_birth_year: payload.hasSpouse ? parseInt(payload.person2BirthYear, 10) || null : null,
    person2_retirement_age: payload.hasSpouse ? parseInt(payload.person2RetirementAge, 10) || null : null,
    person2_ss_claiming_age: payload.hasSpouse ? parseInt(payload.person2SSClaimingAge, 10) || null : null,
    person2_longevity_age: payload.hasSpouse ? parseInt(payload.person2LongevityAge, 10) || null : null,
    person2_ss_pia:
      payload.hasSpouse && payload.person2SSPia.trim() !== '' ? Number(payload.person2SSPia) : null,
    filing_status: filingStatus,
    state_primary: payload.statePrimary || null,
    state_compare: payload.stateCompare || null,
    inflation_rate: parseFloat(payload.inflationRate) || 2.5,
    risk_tolerance: payload.riskTolerance,
    growth_rate_accumulation: Number(payload.growthRateAccumulation) || 7,
    growth_rate_retirement: Number(payload.growthRateRetirement) || 5,
    deduction_mode: payload.deductionMode,
    custom_deduction_amount: parseFloat(payload.customDeductionAmount) || 0,
    gross_estate_estimate:
      payload.grossEstateEstimate &&
      GROSS_ESTATE_ESTIMATE_VALUES.includes(
        payload.grossEstateEstimate as (typeof GROSS_ESTATE_ESTIMATE_VALUES)[number],
      )
        ? payload.grossEstateEstimate
        : null,
    has_minor_children: payload.hasMinorChildren ?? null,
    has_business_interests: payload.hasBusinessInterests ?? null,
    updated_at: new Date().toISOString(),
  }
}
