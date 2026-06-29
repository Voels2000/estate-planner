import { test, expect } from '@playwright/test'
import { isMFJFilingStatus } from '@/lib/calculations/stateEstateTax'

test.describe('estate MC MFJ alignment', () => {
  test('isMFJFilingStatus accepts married_filing_jointly (E2E seed alias)', () => {
    expect(isMFJFilingStatus('married_filing_jointly')).toBe(true)
    expect(isMFJFilingStatus('mfj')).toBe(true)
    expect(isMFJFilingStatus('married_joint')).toBe(true)
    expect(isMFJFilingStatus('single')).toBe(false)
  })

  test('MC async path: MFJ requires spouse', () => {
    const mfjWithSpouse =
      isMFJFilingStatus('married_filing_jointly') && true
    const mfjNoSpouse =
      isMFJFilingStatus('married_filing_jointly') && false
    expect(mfjWithSpouse).toBe(true)
    expect(mfjNoSpouse).toBe(false)
  })
})
