'use client'

import { useState } from 'react'
import { BILLING_DISCLOSURES } from '@/lib/compliance/billing-disclosures'

type Props = {
  planName: string
  unitRate: number
  priceId: string
  minUnits?: number
  maxUnits: number
  unitLabel?: 'seat' | 'client'
}

export function PricingAdvisorCheckout({
  planName,
  unitRate,
  priceId,
  minUnits = 1,
  maxUnits,
  unitLabel = 'seat',
}: Props) {
  const [unitCount, setUnitCount] = useState(minUnits)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveUnits = Math.min(Math.max(minUnits, unitCount || minUnits), maxUnits)
  const totalMonthly = unitRate * effectiveUnits
  const unitNoun = unitLabel === 'client' ? 'connected clients' : 'advisor seats'

  async function handleCheckout() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/firm-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, seatCount: effectiveUnits }),
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
      <div style={{ marginBottom: 12 }}>
        <label
          htmlFor={`advisor-units-${planName}`}
          style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#4a5568', marginBottom: 6 }}
        >
          How many {unitNoun}?
        </label>
        <input
          id={`advisor-units-${planName}`}
          type="number"
          min={minUnits}
          max={maxUnits}
          value={unitCount}
          onChange={(e) => {
            const parsed = parseInt(e.target.value, 10)
            setUnitCount(Number.isNaN(parsed) ? minUnits : parsed)
          }}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            fontSize: 13,
            fontFamily: 'DM Sans, system-ui, sans-serif',
          }}
        />
        <p style={{ fontSize: 12, fontWeight: 600, color: '#0f1f3d', marginTop: 8 }}>
          Estimated: ${totalMonthly.toLocaleString('en-US')}/month at ${unitRate}/{unitLabel}
        </p>
      </div>
      <p style={{ fontSize: 12, color: '#4a5568', lineHeight: 1.6, marginBottom: 12 }}>
        {BILLING_DISCLOSURES.preCheckout(planName, `$${totalMonthly.toLocaleString('en-US')}`, 'month')}
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
