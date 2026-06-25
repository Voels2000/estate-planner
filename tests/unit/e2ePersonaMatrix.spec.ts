import { test, expect } from '@playwright/test'
import { E2E_IDENTITIES } from '../../scripts/e2e-test-identities'
import {
  E2E_APP_TRIAL_WINDOW_MS,
  E2E_PERSONA_MATRIX,
  e2eAppTrialEndsAtIso,
  formatPersonaMatrixNotSeededMessage,
  isPersonaMatrixNotSeededOnly,
} from '../../scripts/e2e-persona-matrix'

test.describe('E2E persona matrix (tier restructure)', () => {
  test('every resolver branch has a dedicated seed identity', () => {
    const branches = E2E_PERSONA_MATRIX.map((row) => row.branch)
    expect(branches).toEqual([
      'tier-0-canceled-has_ever_subscribed',
      'app-managed-trial',
      'active-tier-1',
      'active-tier-2',
      'active-tier-3',
      'plan-export-purchaser-no-sub',
    ])
  })

  test('matrix emails map to E2E_IDENTITIES (no drift)', () => {
    const byEmail = new Map(E2E_PERSONA_MATRIX.map((row) => [row.email, row.branch]))
    expect(byEmail.get(E2E_IDENTITIES.consumerCanceled.email)).toBe('tier-0-canceled-has_ever_subscribed')
    expect(byEmail.get(E2E_IDENTITIES.consumerAppTrial.email)).toBe('app-managed-trial')
    expect(byEmail.get(E2E_IDENTITIES.consumerTier1.email)).toBe('active-tier-1')
    expect(byEmail.get(E2E_IDENTITIES.consumerTier2.email)).toBe('active-tier-2')
    expect(byEmail.get(E2E_IDENTITIES.consumer.email)).toBe('active-tier-3')
    expect(byEmail.get(E2E_IDENTITIES.consumerPlanExport.email)).toBe('plan-export-purchaser-no-sub')
  })

  test('PR1 trial columns are explicit on every matrix row', () => {
    for (const row of E2E_PERSONA_MATRIX) {
      expect(typeof row.has_ever_subscribed).toBe('boolean')
      expect(['null', 'future']).toContain(row.trial_ends_at)
    }
    const trialRow = E2E_PERSONA_MATRIX.find((r) => r.branch === 'app-managed-trial')
    expect(trialRow?.has_ever_subscribed).toBe(false)
    expect(trialRow?.trial_ends_at).toBe('future')

    const canceledRow = E2E_PERSONA_MATRIX.find((r) => r.branch === 'tier-0-canceled-has_ever_subscribed')
    expect(canceledRow?.has_ever_subscribed).toBe(true)
    expect(canceledRow?.trial_ends_at).toBe('null')
  })

  test('app-trial window is ~2 years (survives long gaps between staging re-seeds)', () => {
    const ends = new Date(e2eAppTrialEndsAtIso(new Date('2026-01-01T00:00:00Z')))
    const expected = new Date('2026-01-01T00:00:00Z').getTime() + E2E_APP_TRIAL_WINDOW_MS
    expect(ends.getTime()).toBe(expected)
    expect(E2E_APP_TRIAL_WINDOW_MS).toBeGreaterThanOrEqual(365 * 24 * 60 * 60 * 1000)
  })

  test('not-seeded-only failures get an actionable message (not a resolver bug)', () => {
    const result = {
      notSeeded: [{ branch: 'app-managed-trial', email: E2E_IDENTITIES.consumerAppTrial.email }],
      mismatches: [],
      queryErrors: [],
    }
    expect(isPersonaMatrixNotSeededOnly(result)).toBe(true)
    const msg = formatPersonaMatrixNotSeededMessage(result)
    expect(msg).toContain('not seeded yet')
    expect(msg).toContain('npm run seed:e2e')
    expect(msg).toContain(E2E_IDENTITIES.consumerAppTrial.email)
  })
})
