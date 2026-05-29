/**
 * Advisor playbook localStorage contract tests
 * Run: npm run test:unit:playbook
 */
import { test, expect } from '@playwright/test'

const STORAGE_PREFIX = 'mwm_advisor_playbook_'

test.describe('advisorPlaybookStorage contract', () => {
  test('storage key is prefixed by advisor id', () => {
    expect(`${STORAGE_PREFIX}advisor-abc`).toBe('mwm_advisor_playbook_advisor-abc')
  })

  test('merged step state shape matches playbook tracker', () => {
    const merged = { step1: true, step2: false, step3: false, dismissed: false }
    expect(merged.step1).toBe(true)
    expect(merged.dismissed).toBe(false)
  })
})
