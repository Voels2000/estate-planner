'use client'

import { useState } from 'react'
import { BILLING_DISCLOSURES } from '@/lib/compliance/billing-disclosures'

type Props = {
  planName: string
  seatRate: number
  priceId: string
  minSeats?: number
  maxSeats: number
}

export function PricingAdvisorCheckout({
  planName,
  seatRate,
  priceId,
  minSeats = 1,
  maxSeats,
}: Props) {
  const [seatCount, setSeatCount] = useState(minSeats)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveSeats = Math.min(Math.max(minSeats, seatCount || minSeats), maxSeats)
  const totalMonthly = seatRate * effectiveSeats

  async function handleCheckout() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/firm-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, seatCount: effectiveSeats }),
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
          htmlFor={`advisor-seats-${planName}`}
          style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#4a5568', marginBottom: 6 }}
        >
          How many advisor seats?
        </label>
        <input
          id={`advisor-seats-${planName}`}
          type="number"
          min={minSeats}
          max={maxSeats}
          value={seatCount}
          onChange={(e) => {
            const parsed = parseInt(e.target.value, 10)
            setSeatCount(Number.isNaN(parsed) ? minSeats : parsed)
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
          Total: ${totalMonthly.toLocaleString('en-US')}/month
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
