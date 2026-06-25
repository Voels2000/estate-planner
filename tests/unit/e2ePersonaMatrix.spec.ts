import { test, expect } from '@playwright/test'
import { E2E_IDENTITIES } from '../../scripts/e2e-test-identities'
import { E2E_PERSONA_MATRIX } from '../../scripts/e2e-persona-matrix'

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
})
