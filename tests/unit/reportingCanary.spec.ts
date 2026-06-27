import { test, expect } from '@playwright/test'
import {
  filterReportingProfiles,
  isReportingExcludedCanaryEmail,
} from '@/lib/admin/reportingCanary'
import { PROD_CANARY_EMAILS } from '../../scripts/e2e-test-identities'

test.describe('isReportingExcludedCanaryEmail', () => {
  test('excludes prod smoke canary addresses', () => {
    for (const email of PROD_CANARY_EMAILS) {
      expect(isReportingExcludedCanaryEmail(email)).toBe(true)
    }
  })

  test('does not exclude real customers or protected accounts', () => {
    expect(isReportingExcludedCanaryEmail('david@gmail.com')).toBe(false)
    expect(isReportingExcludedCanaryEmail('avoels@comcast.net')).toBe(false)
    expect(isReportingExcludedCanaryEmail('e2e-consumer@mywealthmaps.test')).toBe(false)
  })

  test('filterReportingProfiles removes canaries only', () => {
    const filtered = filterReportingProfiles([
      { email: 'canary-advisor@mywealthmaps.com', id: '1' },
      { email: 'real@example.com', id: '2' },
    ])
    expect(filtered).toEqual([{ email: 'real@example.com', id: '2' }])
  })
})
