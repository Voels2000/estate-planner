import { test, expect } from '@playwright/test'
import { mergeLicensedStates } from '../../lib/directory/professionalCredential'

test.describe('professionalCredential helpers', () => {
  test('mergeLicensedStates dedupes and uppercases', () => {
    expect(mergeLicensedStates(['wa', 'or'], 'wa')).toEqual(['WA', 'OR'])
    expect(mergeLicensedStates(null, 'ny')).toEqual(['NY'])
  })
})
