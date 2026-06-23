/**
 * Consumer checkout route guard — Stripe session must not be created when blocked.
 * Run: npx playwright test tests/unit/processConsumerCheckout.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import { processConsumerCheckout } from '../../lib/billing/processConsumerCheckout'
import type { ConsumerCheckoutStripe } from '../../lib/billing/processConsumerCheckout'
import type { SupabaseClient } from '@supabase/supabase-js'

function mockSupabase(): SupabaseClient {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'single', 'update'] as const) {
    chain[m] = () => chain
  }
  chain.single = async () => ({ data: { role: 'consumer' }, error: null })
  return { from: () => chain } as unknown as SupabaseClient
}

function mockStripe(opts?: {
  retrieve?: () => Promise<{ id: string; deleted?: boolean }>
}) {
  let checkoutCreateCalls = 0
  let customerCreateCalls = 0
  let customerRetrieveCalls = 0
  const stripe = {
    customers: {
      retrieve: async () => {
        customerRetrieveCalls += 1
        if (opts?.retrieve) return opts.retrieve()
        return { id: 'cus_existing', deleted: false as const }
      },
      create: async () => {
        customerCreateCalls += 1
        return { id: 'cus_new' }
      },
    },
    checkout: {
      sessions: {
        create: async () => {
          checkoutCreateCalls += 1
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
    get customerCreateCalls() {
      return customerCreateCalls
    },
    get customerRetrieveCalls() {
      return customerRetrieveCalls
    },
  }
}

const baseInput = {
  user: { id: 'user-1', email: 'user@test.com' },
  priceId: 'price_financial_monthly',
  trialDays: 0,
  baseUrl: 'http://localhost:3000',
  supabase: mockSupabase(),
  admin: mockSupabase(),
}

const blockedStatuses = [
  { status: 'past_due', code: 'past_due', httpStatus: 409 },
  { status: 'advisor_managed', code: 'advisor_managed', httpStatus: 403 },
  { status: 'attorney_managed', code: 'attorney_managed', httpStatus: 403 },
  { status: 'active', code: 'already_subscribed', httpStatus: 409 },
  { status: 'trialing', code: 'already_subscribed', httpStatus: 409 },
  { status: 'canceling', code: 'already_subscribed', httpStatus: 409 },
] as const

test.describe('processConsumerCheckout guard', () => {
  for (const { status, code, httpStatus } of blockedStatuses) {
    test(`blocks ${status} without creating Stripe checkout session`, async () => {
      const mocks = mockStripe()
      const result = await processConsumerCheckout({
        ...baseInput,
        stripe: mocks.stripe,
        billingProfile: {
          subscription_status: status,
          stripe_customer_id: 'cus_existing',
        },
        isAdvisorClient: false,
      })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.block.code).toBe(code)
      expect(result.block.httpStatus).toBe(httpStatus)
      expect(mocks.checkoutCreateCalls).toBe(0)
      expect(mocks.customerCreateCalls).toBe(0)
    })
  }

  test('blocks advisor_managed via subscription_plan without Stripe calls', async () => {
    const mocks = mockStripe()
    const result = await processConsumerCheckout({
      ...baseInput,
      stripe: mocks.stripe,
      billingProfile: {
        subscription_status: 'none',
        subscription_plan: 'advisor_managed',
        stripe_customer_id: 'cus_existing',
      },
      isAdvisorClient: false,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.block.code).toBe('advisor_managed')
    expect(mocks.checkoutCreateCalls).toBe(0)
  })

  test('blocks connected advisor client without Stripe calls', async () => {
    const mocks = mockStripe()
    const result = await processConsumerCheckout({
      ...baseInput,
      stripe: mocks.stripe,
      billingProfile: {
        subscription_status: 'none',
        stripe_customer_id: 'cus_existing',
      },
      isAdvisorClient: true,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.block.code).toBe('advisor_client')
    expect(mocks.checkoutCreateCalls).toBe(0)
  })

  test('creates checkout session for eligible consumer', async () => {
    const mocks = mockStripe()
    const result = await processConsumerCheckout({
      ...baseInput,
      stripe: mocks.stripe,
      billingProfile: {
        subscription_status: 'none',
        stripe_customer_id: 'cus_existing',
      },
      isAdvisorClient: false,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.url).toMatch(/^https:\/\/checkout\.stripe\.test/)
    expect(mocks.checkoutCreateCalls).toBe(1)
    expect(mocks.customerRetrieveCalls).toBe(1)
    expect(mocks.customerCreateCalls).toBe(0)
  })

  test('recreates Stripe customer when stored id is missing in current environment', async () => {
    const mocks = mockStripe({
      retrieve: async () => {
        const err = new Error('No such customer') as Error & { code: string }
        err.code = 'resource_missing'
        throw err
      },
    })
    const result = await processConsumerCheckout({
      ...baseInput,
      stripe: mocks.stripe,
      billingProfile: {
        subscription_status: 'none',
        stripe_customer_id: 'cus_stale_cross_env',
      },
      isAdvisorClient: false,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(mocks.customerRetrieveCalls).toBe(1)
    expect(mocks.customerCreateCalls).toBe(1)
    expect(mocks.checkoutCreateCalls).toBe(1)
  })

  test('recreates Stripe customer when stored id is deleted', async () => {
    const mocks = mockStripe({
      retrieve: async () => ({ id: 'cus_deleted', deleted: true }),
    })
    const result = await processConsumerCheckout({
      ...baseInput,
      stripe: mocks.stripe,
      billingProfile: {
        subscription_status: 'none',
        stripe_customer_id: 'cus_deleted',
      },
      isAdvisorClient: false,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(mocks.customerCreateCalls).toBe(1)
    expect(mocks.checkoutCreateCalls).toBe(1)
  })

  test('throws on invalid checkout baseUrl', async () => {
    const mocks = mockStripe()
    await expect(
      processConsumerCheckout({
        ...baseInput,
        baseUrl: 'estate-planner-staging.vercel.app',
        stripe: mocks.stripe,
        billingProfile: { subscription_status: 'none' },
        isAdvisorClient: false,
      }),
    ).rejects.toThrow(/Invalid checkout baseUrl/)
    expect(mocks.checkoutCreateCalls).toBe(0)
  })

  test('creates checkout session for canceled consumer', async () => {
    const mocks = mockStripe()
    const result = await processConsumerCheckout({
      ...baseInput,
      stripe: mocks.stripe,
      billingProfile: {
        subscription_status: 'canceled',
        stripe_customer_id: 'cus_existing',
      },
      isAdvisorClient: false,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(mocks.checkoutCreateCalls).toBe(1)
  })
})
