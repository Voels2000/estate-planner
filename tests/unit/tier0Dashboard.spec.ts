import { readFileSync } from 'fs'
import { join } from 'path'
import { test, expect } from '@playwright/test'
import {
  __getTriggerCallsForTests,
  __resetTriggerCallsForTests,
  triggerBackgroundBaseCaseAndRecompute,
} from '@/lib/projections/triggerBackgroundBaseCase'
import {
  PR2_NET_WORTH_PARITY_FIXTURE,
  compositionForParityFixture,
  computeNetWorthFromComposition,
  computeNetWorthFromInputTables,
} from '@/lib/dashboard/computeNetWorthFromInputTables'
import { shouldUseTier0Dashboard } from '@/lib/dashboard/shouldUseTier0Dashboard'
import type { UserAccess } from '@/lib/get-user-access'

const tier0Access: UserAccess = {
  tier: 0,
  isAdvisor: false,
  isAdvisorClient: false,
  isAdmin: false,
  isTrial: false,
  subscriptionStatus: 'canceled',
  trialEndsAt: null,
}

const trialAccess: UserAccess = {
  ...tier0Access,
  tier: 3,
  isTrial: true,
  subscriptionStatus: 'none',
}

test.describe('shouldUseTier0Dashboard', () => {
  test('routes ex-subscribers and free tier to thin dashboard', () => {
    expect(shouldUseTier0Dashboard(tier0Access)).toBe(true)
  })

  test('trial users keep full dashboard (effective tier 3)', () => {
    expect(shouldUseTier0Dashboard(trialAccess)).toBe(false)
  })

  test('paid tier 1+ keeps full dashboard', () => {
    expect(shouldUseTier0Dashboard({ ...tier0Access, tier: 1 })).toBe(false)
  })
})

test.describe('net-worth parity (PR 2 fixture)', () => {
  test('input-table path matches composition path — $1.05M total', () => {
    const fromInputs = computeNetWorthFromInputTables(PR2_NET_WORTH_PARITY_FIXTURE)
    const fromComposition = computeNetWorthFromComposition(
      compositionForParityFixture(),
      PR2_NET_WORTH_PARITY_FIXTURE,
    )

    expect(fromInputs.netWorth).toBe(1_050_000)
    expect(fromComposition.netWorth).toBe(1_050_000)
    expect(fromInputs.realEstateValue).toBe(1_000_000)
    expect(fromInputs.businessValue).toBe(250_000)
    expect(fromInputs.netWorth).toBe(fromComposition.netWorth)
  })
})

test.describe('compute-safety architecture', () => {
  const tier0Files = [
    'lib/dashboard/loadTier0Dashboard.ts',
    'lib/dashboard/computeNetWorthFromInputTables.ts',
    'lib/dashboard/shouldUseTier0Dashboard.ts',
    'app/(dashboard)/dashboard/_tier0-dashboard-body.tsx',
  ]

  const forbidden = [
    'loadDashboardBundle',
    'triggerBackgroundBaseCaseAndRecompute',
    'getCachedComposition',
    'loadScenarioMonteCarloWithStaleness',
    'triggerEstateHealthRecompute',
    'generateBaseCase',
  ]

  for (const rel of tier0Files) {
    test(`${rel} does not import heavy side-effect modules`, () => {
      const src = readFileSync(join(process.cwd(), rel), 'utf8')
      for (const token of forbidden) {
        expect(src.includes(token), `${rel} must not reference ${token}`).toBe(false)
      }
    })
  }

  test('trigger spy records calls (heavy path only)', () => {
    __resetTriggerCallsForTests()
    triggerBackgroundBaseCaseAndRecompute('household-test-id')
    expect(__getTriggerCallsForTests()).toEqual(['household-test-id'])
    __resetTriggerCallsForTests()
    expect(__getTriggerCallsForTests()).toEqual([])
  })
})

test.describe('PR 2 gated routes — early return before loaders', () => {
  test('/projections gate is before loadProjectionData', () => {
    const src = readFileSync(
      join(process.cwd(), 'app/(dashboard)/projections/page.tsx'),
      'utf8',
    )
    const gateIdx = src.indexOf("if (!hasFeatureAccess('projections'")
    const loadIdx = src.indexOf('const projectionLoad = await loadProjectionData')
    const triggerIdx = src.indexOf('triggerBackgroundBaseCaseAndRecompute')
    expect(gateIdx).toBeGreaterThan(-1)
    expect(loadIdx).toBeGreaterThan(gateIdx)
    expect(triggerIdx).toBeGreaterThan(loadIdx)
  })

  test('/scenarios gate is before projection/scenario loaders', () => {
    const src = readFileSync(
      join(process.cwd(), 'app/(dashboard)/scenarios/page.tsx'),
      'utf8',
    )
    const gateIdx = src.indexOf("if (!hasFeatureAccess('scenarios'")
    const householdLoadIdx = src.indexOf("from('households')")
    expect(gateIdx).toBeGreaterThan(-1)
    expect(householdLoadIdx).toBeGreaterThan(gateIdx)
  })
})
