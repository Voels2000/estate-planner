/**
 * PR 5 — retire Stripe Estate trial (trialDays: 0) + consumer CTA copy.
 * Run: npx playwright test tests/unit/retireStripeConsumerTrial.spec.ts --project=import-unit
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { CONSUMER_PLAN_CATALOG } from '@/lib/billing/consumerPlanCatalog'
import { getConsumerPlanDisplay } from '@/lib/billing/stripePrices'
import { processConsumerCheckout } from '@/lib/billing/processConsumerCheckout'
import type { ConsumerCheckoutStripe } from '@/lib/billing/processConsumerCheckout'
import type { SupabaseClient } from '@supabase/supabase-js'

test.describe('retire Stripe consumer trial (PR 5)', () => {
  test('Estate monthly and annual trialDays are 0', () => {
    expect(getConsumerPlanDisplay(3, 'monthly').trialDays).toBe(0)
    expect(getConsumerPlanDisplay(3, 'annual').trialDays).toBe(0)
  })

  test('Estate catalog CTA is Subscribe with no trial badge', () => {
    const estate = CONSUMER_PLAN_CATALOG.find((p) => p.id === 'estate')
    expect(estate?.cta).toBe('Subscribe')
    expect(estate?.badge).toBeNull()
  })

  test('no consumer checkout CTA promises Start free trial', () => {
    const roots = ['app/(public)/pricing', 'app/billing', 'lib/billing/consumerPlanCatalog.ts']
    const offenders: string[] = []

    for (const rel of roots) {
      const path = join(process.cwd(), rel)
      const st = statSync(path)
      if (st.isFile()) {
        if (readFileSync(path, 'utf8').includes('Start free trial')) offenders.push(rel)
      } else {
        walkTs(path, (file) => {
          const relFile = file.replace(process.cwd() + '/', '')
          if (readFileSync(file, 'utf8').includes('Start free trial')) {
            offenders.push(relFile)
          }
        })
      }
    }

    expect(offenders, `hardcoded trial CTA: ${offenders.join(', ')}`).toEqual([])
  })

  test('Estate checkout omits trial_period_days when trialDays is 0', async () => {
    let sessionPayload: Record<string, unknown> | undefined
    const stripe = {
      customers: {
        retrieve: async () => ({ id: 'cus_existing', deleted: false as const }),
      },
      checkout: {
        sessions: {
          create: async (payload: Record<string, unknown>) => {
            sessionPayload = payload
            return { url: 'https://checkout.stripe.test/estate' }
          },
        },
      },
    }

    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'single', 'update'] as const) {
      chain[m] = () => chain
    }
    chain.single = async () => ({ data: { role: 'consumer' }, error: null })
    const supabase = { from: () => chain } as unknown as SupabaseClient

    const result = await processConsumerCheckout({
      user: { id: 'user-1', email: 'user@test.com' },
      priceId: 'price_estate_monthly',
      trialDays: 0,
      baseUrl: 'http://localhost:3000',
      supabase,
      admin: supabase,
      stripe: stripe as unknown as ConsumerCheckoutStripe,
      billingProfile: { subscription_status: 'none', stripe_customer_id: 'cus_existing' },
      isAdvisorClient: false,
    })

    expect(result.ok).toBe(true)
    expect(sessionPayload?.subscription_data).toBeUndefined()
  })
})

/**
 * Consumer-path trialing readers after PR 5 — new checkouts never write `trialing`,
 * but legacy rows and firm paths must keep handling it.
 */
test.describe('consumer trialing grep audit (PR 5)', () => {
  const intentionalTrialingReaders = [
    'lib/billing/b2b2cBillingPolicy.ts',
    'lib/access/resolveEffectiveTier.ts',
    'lib/billing/resolveBillingTrialBanner.ts',
    'lib/billing/syncConsumerStripeSubscription.ts',
    'app/api/stripe/webhook/route.ts',
    'lib/stripe/consumerSubscriptionStatus.ts',
    'app/billing/_billing-client.tsx',
    'lib/access/hasEverSubscribed.ts',
    'lib/access/advisorBillingGate.ts',
  ]

  test('intentional consumer trialing readers still present', () => {
    for (const rel of intentionalTrialingReaders) {
      const src = readFileSync(join(process.cwd(), rel), 'utf8')
      expect(src, `${rel} should still reference trialing for legacy subs`).toContain('trialing')
    }
  })
})

function walkTs(dir: string, visit: (file: string) => void) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) {
      if (name === 'node_modules') continue
      walkTs(path, visit)
    } else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      visit(path)
    }
  }
}
