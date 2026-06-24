import { test, expect } from '@playwright/test'
import {
  resolveEffectiveTier,
  isAppManagedTrialActive,
  resolveConsumerIsTrial,
} from '@/lib/access/resolveEffectiveTier'

const baseProfile = {
  role: 'consumer',
  consumer_tier: 0,
  subscription_status: 'none',
  subscription_plan: null,
  has_ever_subscribed: false,
} as const

function futureIso() {
  return new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
}

function pastIso() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

const noBypass = {
  isAdvisor: false,
  isAdvisorClient: false,
  isProfessionallyManaged: false,
}

test.describe('resolveEffectiveTier', () => {
  test('inactive consumer with no trial resolves to Tier 0', () => {
    expect(
      resolveEffectiveTier(
        { ...baseProfile, trial_ends_at: null },
        noBypass,
      ),
    ).toBe(0)
  })

  test('app trial window grants TRIAL_TIER (3)', () => {
    expect(
      resolveEffectiveTier(
        { ...baseProfile, trial_ends_at: futureIso() },
        noBypass,
      ),
    ).toBe(3)
  })

  test('expired app trial resolves to Tier 0', () => {
    expect(
      resolveEffectiveTier(
        { ...baseProfile, trial_ends_at: pastIso() },
        noBypass,
      ),
    ).toBe(0)
  })

  test('subscribe then cancel resolves to Tier 0, not trial', () => {
    expect(
      resolveEffectiveTier(
        {
          ...baseProfile,
          has_ever_subscribed: true,
          subscription_status: 'canceled',
          consumer_tier: 3,
          trial_ends_at: futureIso(),
        },
        noBypass,
      ),
    ).toBe(0)
  })

  test('has_ever_subscribed is checked before trial window', () => {
    const now = new Date('2026-06-18T12:00:00Z')
    expect(
      resolveEffectiveTier(
        {
          ...baseProfile,
          has_ever_subscribed: true,
          trial_ends_at: '2026-06-25T12:00:00Z',
        },
        { ...noBypass, now },
      ),
    ).toBe(0)
  })

  test('active subscription uses paid tier from profile', () => {
    expect(
      resolveEffectiveTier(
        {
          ...baseProfile,
          subscription_status: 'active',
          consumer_tier: 2,
          has_ever_subscribed: true,
        },
        noBypass,
      ),
    ).toBe(2)
  })

  test('Stripe trialing uses paid tier path', () => {
    expect(
      resolveEffectiveTier(
        {
          ...baseProfile,
          subscription_status: 'trialing',
          consumer_tier: 3,
          has_ever_subscribed: true,
        },
        noBypass,
      ),
    ).toBe(3)
  })

  test('advisor client bypass resolves to Tier 3', () => {
    expect(
      resolveEffectiveTier(baseProfile, {
        ...noBypass,
        isAdvisorClient: true,
      }),
    ).toBe(3)
  })
})

test.describe('resolveConsumerIsTrial', () => {
  test('app trial user is trial when not subscribed', () => {
    expect(
      resolveConsumerIsTrial(
        { ...baseProfile, trial_ends_at: futureIso() },
        'none',
      ),
    ).toBe(true)
  })

  test('subscribe-then-cancel is not trial', () => {
    expect(
      resolveConsumerIsTrial(
        {
          ...baseProfile,
          has_ever_subscribed: true,
          trial_ends_at: futureIso(),
        },
        'canceled',
      ),
    ).toBe(false)
  })

  test('Stripe trialing is trial', () => {
    expect(
      resolveConsumerIsTrial(
        { ...baseProfile, has_ever_subscribed: true },
        'trialing',
      ),
    ).toBe(true)
  })
})

test.describe('isAppManagedTrialActive', () => {
  test('false when has_ever_subscribed', () => {
    expect(
      isAppManagedTrialActive({
        trial_ends_at: futureIso(),
        has_ever_subscribed: true,
      }),
    ).toBe(false)
  })
})
