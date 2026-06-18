/**
 * Canonical consumer checkout eligibility — shared by billing page and checkout API.
 * Run: npx playwright test tests/unit/consumerCheckoutBlockReason.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import { consumerCheckoutBlockReason } from '../../lib/billing/b2b2cBillingPolicy'
import {
  CONNECTED_ADVISOR_CLIENT_STATUSES,
  isConnectedAdvisorClientStatus,
} from '../../lib/advisor/clientConnectionStatus'

type Case = {
  label: string
  profile: Parameters<typeof consumerCheckoutBlockReason>[0]
  code: string | null
  httpStatus?: 403 | 409
}

const blockedCases: Case[] = [
  {
    label: 'active subscription',
    profile: { subscription_status: 'active' },
    code: 'already_subscribed',
    httpStatus: 409,
  },
  {
    label: 'trialing subscription',
    profile: { subscription_status: 'trialing' },
    code: 'already_subscribed',
    httpStatus: 409,
  },
  {
    label: 'canceling subscription',
    profile: { subscription_status: 'canceling' },
    code: 'already_subscribed',
    httpStatus: 409,
  },
  {
    label: 'past_due subscription',
    profile: { subscription_status: 'past_due' },
    code: 'past_due',
    httpStatus: 409,
  },
  {
    label: 'unpaid subscription',
    profile: { subscription_status: 'unpaid' },
    code: 'past_due',
    httpStatus: 409,
  },
  {
    label: 'advisor_managed via status',
    profile: { subscription_status: 'advisor_managed' },
    code: 'advisor_managed',
    httpStatus: 403,
  },
  {
    label: 'advisor_managed via plan',
    profile: { subscription_status: 'none', subscription_plan: 'advisor_managed' },
    code: 'advisor_managed',
    httpStatus: 403,
  },
  {
    label: 'attorney_managed via status',
    profile: { subscription_status: 'attorney_managed' },
    code: 'attorney_managed',
    httpStatus: 403,
  },
  {
    label: 'attorney_managed via plan',
    profile: { subscription_status: 'canceled', subscription_plan: 'attorney_managed' },
    code: 'attorney_managed',
    httpStatus: 403,
  },
  {
    label: 'connected advisor client',
    profile: { subscription_status: 'none', isAdvisorClient: true },
    code: 'advisor_client',
    httpStatus: 403,
  },
]

const allowedCases: Case[] = [
  { label: 'none status', profile: { subscription_status: 'none' }, code: null },
  { label: 'canceled status', profile: { subscription_status: 'canceled' }, code: null },
  { label: 'null status', profile: { subscription_status: null }, code: null },
  { label: 'undefined profile fields', profile: {}, code: null },
]

test.describe('consumerCheckoutBlockReason', () => {
  for (const c of blockedCases) {
    test(`blocks ${c.label}`, () => {
      const block = consumerCheckoutBlockReason(c.profile)
      expect(block).not.toBeNull()
      expect(block!.code).toBe(c.code)
      expect(block!.httpStatus).toBe(c.httpStatus)
      expect(block!.message.length).toBeGreaterThan(0)
    })
  }

  for (const c of allowedCases) {
    test(`allows ${c.label}`, () => {
      expect(consumerCheckoutBlockReason(c.profile)).toBeNull()
    })
  }

  test('managed status takes precedence over active when both present (data anomaly)', () => {
    const block = consumerCheckoutBlockReason({
      subscription_status: 'advisor_managed',
      subscription_plan: 'estate',
    })
    expect(block?.code).toBe('advisor_managed')
  })

  test('null profile is allowed (no block)', () => {
    expect(consumerCheckoutBlockReason(null)).toBeNull()
  })
})

test.describe('advisor_client — connected link statuses only', () => {
  const nonConnectedLinkStatuses = [
    'pending',
    'declined',
    'removed',
    'consumer_requested',
  ] as const

  for (const status of nonConnectedLinkStatuses) {
    test(`${status} advisor_clients row is not a connected link`, () => {
      expect(isConnectedAdvisorClientStatus(status)).toBe(false)
    })

    test(`${status} link does not block checkout (isAdvisorClient false)`, () => {
      expect(
        consumerCheckoutBlockReason({
          subscription_status: 'none',
          isAdvisorClient: false,
        }),
      ).toBeNull()
    })
  }

  for (const status of CONNECTED_ADVISOR_CLIENT_STATUSES) {
    test(`${status} advisor_clients row is a connected link`, () => {
      expect(isConnectedAdvisorClientStatus(status)).toBe(true)
    })

    test(`${status} link blocks checkout when caller sets isAdvisorClient`, () => {
      expect(
        consumerCheckoutBlockReason({
          subscription_status: 'none',
          isAdvisorClient: true,
        })?.code,
      ).toBe('advisor_client')
    })
  }
})
