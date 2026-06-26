/**
 * Plan & Export checkout — refund ack server gate.
 * Run: npx playwright test tests/unit/processPlanAndExportCheckout.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import { processPlanAndExportCheckout } from '../../lib/billing/processConsumerCheckout'
import type { ConsumerCheckoutStripe } from '../../lib/billing/processConsumerCheckout'
import type { SupabaseClient } from '@supabase/supabase-js'
import { REFUND_POLICY_VERSION } from '../../lib/legal/plan-export-refund-policy'

function mockSupabase(): SupabaseClient {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'single', 'update'] as const) {
    chain[m] = () => chain
  }
  chain.single = async () => ({ data: { role: 'consumer' }, error: null })
  return { from: () => chain } as unknown as SupabaseClient
}

function mockStripe() {
  let checkoutCreateCalls = 0
  let lastMetadata: Record<string, string> | undefined
  const stripe = {
    customers: {
      retrieve: async () => ({ id: 'cus_existing', deleted: false as const }),
      create: async () => ({ id: 'cus_new' }),
    },
    checkout: {
      sessions: {
        create: async (params: { metadata?: Record<string, string> }) => {
          checkoutCreateCalls += 1
          lastMetadata = params.metadata
          return { url: 'https://checkout.stripe.test/session' }
        },
      },
    },
  }
  return {
    stripe: stripe as unknown as ConsumerCheckoutStripe,
    get checkoutCreateCalls() {
      return checkoutCreateCalls
    },
    get lastMetadata() {
      return lastMetadata
    },
  }
}

const baseInput = {
  user: { id: 'user-1', email: 'user@test.com' },
  baseUrl: 'http://localhost:3000',
  supabase: mockSupabase(),
  admin: mockSupabase(),
  billingProfile: { subscription_status: 'none', subscription_plan: null, stripe_customer_id: 'cus_existing' },
  isAdvisorClient: false,
}

test.describe('processPlanAndExportCheckout refund ack', () => {
  test('rejects without ack — no Stripe session created', async () => {
    const { stripe, checkoutCreateCalls } = mockStripe()
    const result = await processPlanAndExportCheckout({
      ...baseInput,
      stripe,
      refundAckAccepted: false,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.block).toMatchObject({
        code: 'refund_ack_required',
        httpStatus: 400,
      })
    }
    expect(checkoutCreateCalls).toBe(0)
  })

  test('creates session with server-stamped ack metadata when ack present', async () => {
    const { stripe, checkoutCreateCalls, lastMetadata } = mockStripe()
    const result = await processPlanAndExportCheckout({
      ...baseInput,
      stripe,
      refundAckAccepted: true,
    })

    expect(result.ok).toBe(true)
    expect(checkoutCreateCalls).toBe(1)
    expect(lastMetadata?.sku).toBe('plan_and_export')
    expect(lastMetadata?.refund_ack_version).toBe(REFUND_POLICY_VERSION)
    expect(lastMetadata?.refund_ack_at).toBeTruthy()
    expect(Number.isNaN(Date.parse(lastMetadata?.refund_ack_at ?? ''))).toBe(false)
  })
})
