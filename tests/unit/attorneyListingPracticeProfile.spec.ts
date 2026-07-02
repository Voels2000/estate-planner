import { test, expect } from '@playwright/test'
import {
  attorneyPracticeProfileMissingFields,
  isAttorneyPracticeProfileComplete,
  isConsumerDirectPaidSubscriber,
  practiceProfileGateErrorMessage,
} from '../../lib/attorney/attorneyListingPracticeProfile'
import {
  formatAttorneyFeeStructureLabel,
  formatAttorneyPracticeAreaLabel,
  normalizeAttorneyCredentials,
  normalizeAttorneyFeeStructure,
  normalizeAttorneySpecializations,
  normalizeLicensedStates,
} from '../../lib/attorney/attorneyPracticeOptions'

test.describe('attorneyPracticeOptions', () => {
  test('normalizes legacy specialization slugs', () => {
    expect(normalizeAttorneySpecializations(['tax', 'estate-planning', 'Elder Law'])).toEqual([
      'tax-planning',
      'estate-planning',
      'elder-law',
    ])
  })

  test('normalizes fee structure freeform values', () => {
    expect(normalizeAttorneyFeeStructure('hourly')).toBe('hourly')
    expect(normalizeAttorneyFeeStructure('Flat fee')).toBe('flat-fee')
    expect(normalizeAttorneyFeeStructure('consultation-based')).toBe('consultation')
    expect(normalizeAttorneyFeeStructure('sliding scale')).toBeNull()
  })

  test('normalizes credentials and states', () => {
    expect(normalizeAttorneyCredentials(['jd', 'LLM', 'ACTEC'])).toEqual(['jd', 'LL.M.', 'ACTEC'])
    expect(normalizeLicensedStates(['wa', ' WA ', 'invalid'])).toEqual(['WA'])
  })
})

test.describe('attorneyListingPracticeProfile', () => {
  const complete = {
    states_licensed: ['WA'],
    specializations: ['estate-planning'],
    credentials: ['JD'],
    fee_structure: 'hourly',
  }

  test('detects complete practice profile', () => {
    expect(isAttorneyPracticeProfileComplete(complete)).toBe(true)
    expect(attorneyPracticeProfileMissingFields(complete)).toEqual([])
  })

  test('lists missing fields', () => {
    expect(
      attorneyPracticeProfileMissingFields({
        states_licensed: [],
        specializations: ['probate'],
        credentials: null,
        fee_structure: null,
      }),
    ).toEqual(['states_licensed', 'credentials', 'fee_structure'])
  })

  test('builds gate error message from missing fields', () => {
    expect(practiceProfileGateErrorMessage(['credentials', 'fee_structure'])).toContain(
      'at least one credential',
    )
  })

  test('formats practice area and fee labels', () => {
    expect(formatAttorneyPracticeAreaLabel('estate-planning')).toBe('Estate planning')
    expect(formatAttorneyFeeStructureLabel('hourly')).toBe('Hourly')
    expect(formatAttorneyFeeStructureLabel('flat-fee')).toBe('Flat fee')
  })

  test('identifies direct paid consumer subscriptions', () => {
    expect(isConsumerDirectPaidSubscriber('active')).toBe(true)
    expect(isConsumerDirectPaidSubscriber('trialing')).toBe(true)
    expect(isConsumerDirectPaidSubscriber('none')).toBe(false)
    expect(isConsumerDirectPaidSubscriber('attorney_managed')).toBe(false)
  })
})
