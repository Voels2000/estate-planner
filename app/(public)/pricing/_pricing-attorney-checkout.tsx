'use client'

import { useState } from 'react'
import { BILLING_DISCLOSURES } from '@/lib/compliance/billing-disclosures'
import type { AttorneyPlanKey } from '@/lib/tiers'

type Props = {
  planName: string
  planKey: AttorneyPlanKey
  priceMonthly: number
}

export function PricingAttorneyCheckout({ planName, planKey, priceMonthly }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCheckout() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/attorney-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Something went wrong.')
        return
      }
      if (data.url && typeof data.url === 'string') {
        window.location.assign(data.url)
        return
      }
      setError('Something went wrong.')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <p style={{ fontSize: 12, color: '#4a5568', lineHeight: 1.6, marginBottom: 12 }}>
        {BILLING_DISCLOSURES.preCheckout(planName, `$${priceMonthly}`, 'month')}
      </p>
      {error && (
        <p style={{ fontSize: 12, color: '#c53030', marginBottom: 12 }}>{error}</p>
      )}
      <button
        type="button"
        onClick={() => void handleCheckout()}
        disabled={loading}
        style={{
          width: '100%',
          padding: '10px',
          borderRadius: 8,
          border: 'none',
          background: '#0f1f3d',
          color: 'white',
          fontSize: 13,
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
          fontFamily: 'DM Sans, system-ui, sans-serif',
        }}
      >
        {loading ? 'Redirecting…' : 'Get started'}
      </button>
    </>
  )
}
