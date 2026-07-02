import { test, expect } from '@playwright/test'
import {
  isConnectionBillingEnabledInEnv,
  isStripePriceRequiredInScope,
} from '@/lib/env/stripePriceRequirements'
import { ENV_MANIFEST } from '@/lib/env/manifest'

function manifestEntry(name: string) {
  const entry = ENV_MANIFEST.find((e) => e.name === name)
  if (!entry) throw new Error(`missing manifest entry: ${name}`)
  return entry
}

test.describe('stripePriceRequirements', () => {
  test('legacy professional prices required on preview when connection billing off', () => {
    const env = { CONNECTION_BILLING_ENABLED: 'false' }
    expect(
      isStripePriceRequiredInScope(
        manifestEntry('STRIPE_PRICE_ADVISOR_STARTER_MONTHLY'),
        'preview',
        env,
      ),
    ).toBe(true)
    expect(
      isStripePriceRequiredInScope(
        manifestEntry('STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY'),
        'preview',
        env,
      ),
    ).toBe(false)
  })

  test('connection prices required on preview when connection billing on', () => {
    const env = { CONNECTION_BILLING_ENABLED: 'true' }
    expect(
      isStripePriceRequiredInScope(
        manifestEntry('STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY'),
        'preview',
        env,
      ),
    ).toBe(true)
    expect(
      isStripePriceRequiredInScope(
        manifestEntry('STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY'),
        'preview',
        env,
      ),
    ).toBe(false)
  })

  test('isConnectionBillingEnabledInEnv is strict true only', () => {
    expect(isConnectionBillingEnabledInEnv({ CONNECTION_BILLING_ENABLED: 'true' })).toBe(true)
    expect(isConnectionBillingEnabledInEnv({ CONNECTION_BILLING_ENABLED: '1' })).toBe(false)
    expect(isConnectionBillingEnabledInEnv({})).toBe(false)
  })
})
