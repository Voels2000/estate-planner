'use client'

import { useState } from 'react'
import { BILLING_DISCLOSURES } from '@/lib/compliance/billing-disclosures'
import type { AttorneyPlanKey } from '@/lib/tiers'

type LegacyProps = {
  mode?: 'legacy'
  planName: string
  planKey: AttorneyPlanKey
  priceMonthly: number
}

type ConnectionProps = {
  mode: 'connection'
  planName: string
  ratePerClient: number
  minClients: number
  maxClients: number
}

type Props = LegacyProps | ConnectionProps

export function PricingAttorneyCheckout(props: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isConnection = props.mode === 'connection'
  const minClients = isConnection ? props.minClients : 1
  const maxClients = isConnection ? props.maxClients : 1
  const [clientCount, setClientCount] = useState(minClients)

  const effectiveClients = isConnection
    ? Math.min(Math.max(minClients, clientCount || minClients), maxClients)
    : 1
  const estimatedMonthly = isConnection ? props.ratePerClient * effectiveClients : props.priceMonthly
  const disclosureAmount = isConnection
    ? `$${estimatedMonthly.toLocaleString('en-US')}`
    : `$${props.priceMonthly}`

  async function handleCheckout() {
    setError(null)
    setLoading(true)
    try {
      const body = isConnection
        ? { quantity: effectiveClients }
        : { planKey: props.planKey }
      const res = await fetch('/api/stripe/attorney-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
      {isConnection && (
        <div style={{ marginBottom: 12 }}>
          <label
            htmlFor={`attorney-clients-${props.planName}`}
            style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#4a5568', marginBottom: 6 }}
          >
            How many client households?
          </label>
          <input
            id={`attorney-clients-${props.planName}`}
            type="number"
            min={minClients}
            max={maxClients}
            value={clientCount}
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10)
              setClientCount(Number.isNaN(parsed) ? minClients : parsed)
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
            Estimated: ${estimatedMonthly.toLocaleString('en-US')}/month at ${props.ratePerClient}/client
          </p>
        </div>
      )}
      <p style={{ fontSize: 12, color: '#4a5568', lineHeight: 1.6, marginBottom: 12 }}>
        {BILLING_DISCLOSURES.preCheckout(props.planName, disclosureAmount, 'month')}
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
