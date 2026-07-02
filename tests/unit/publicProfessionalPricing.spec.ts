import { test, expect } from '@playwright/test'
import {
  ADVISOR_BANDS,
  ATTORNEY_BANDS,
} from '@/lib/pricing/connectionPricing'
import {
  getPublicAdvisorPlans,
  getPublicAttorneyPlans,
} from '@/lib/pricing/publicProfessionalPricing'

test.describe('publicProfessionalPricing', () => {
  test('legacy advisor plans use per-seat rates from tiers', () => {
    const prev = process.env.CONNECTION_BILLING_ENABLED
    process.env.CONNECTION_BILLING_ENABLED = 'false'
    try {
      const plans = getPublicAdvisorPlans()
      expect(plans).toHaveLength(3)
      expect(plans.every((p) => p.mode === 'legacy')).toBe(true)
      expect(plans.map((p) => (p.mode === 'legacy' ? p.seatRate : 0))).toEqual([149, 99, 89])
    } finally {
      process.env.CONNECTION_BILLING_ENABLED = prev
    }
  })

  test('connection advisor plans mirror ADVISOR_BANDS rates', () => {
    const prev = process.env.CONNECTION_BILLING_ENABLED
    process.env.CONNECTION_BILLING_ENABLED = 'true'
    try {
      const plans = getPublicAdvisorPlans()
      expect(plans).toHaveLength(ADVISOR_BANDS.length)
      expect(plans.every((p) => p.mode === 'connection')).toBe(true)
      expect(plans.map((p) => (p.mode === 'connection' ? p.ratePerClient : 0))).toEqual(
        ADVISOR_BANDS.map((b) => b.rate),
      )
      const growth = plans.find((p) => p.name === 'Growth')
      expect(growth?.mode === 'connection' && growth.popular).toBe(true)
    } finally {
      process.env.CONNECTION_BILLING_ENABLED = prev
    }
  })

  test('connection attorney free tier uses 1 client cap', () => {
    const prev = process.env.CONNECTION_BILLING_ENABLED
    process.env.CONNECTION_BILLING_ENABLED = 'true'
    try {
      const plans = getPublicAttorneyPlans()
      const free = plans.find((p) => p.name === 'Free')
      expect(free?.mode === 'connection' && free.clientCap).toBe(1)
      expect(plans.filter((p) => p.mode === 'connection' && p.price > 0)).toHaveLength(
        ATTORNEY_BANDS.length,
      )
    } finally {
      process.env.CONNECTION_BILLING_ENABLED = prev
    }
  })

  test('legacy attorney plans keep flat tier prices', () => {
    const prev = process.env.CONNECTION_BILLING_ENABLED
    process.env.CONNECTION_BILLING_ENABLED = 'false'
    try {
      const plans = getPublicAttorneyPlans()
      const starter = plans.find((p) => p.name === 'Starter')
      expect(starter?.mode === 'legacy' && starter.price).toBe(99)
      const free = plans.find((p) => p.name === 'Free')
      expect(free?.mode === 'legacy' && free.clientCap).toBe(3)
    } finally {
      process.env.CONNECTION_BILLING_ENABLED = prev
    }
  })
})
