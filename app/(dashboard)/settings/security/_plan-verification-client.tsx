'use client'

import { useState } from 'react'

type MatrixRow = {
  metric: string
  compositionCache: number | null
  compositionLive: number | null
  exportEngineB: number | null
  horizonsToday: number | null
  pass: boolean
  note?: string
}

type VerifyResponse = {
  passed: boolean
  matrix: MatrixRow[]
  error?: string
}

type Props = {
  householdId: string
}

function fmt(n: number | null) {
  if (n == null) return '—'
  return `$${Math.round(n).toLocaleString()}`
}

export default function PlanVerificationClient({ householdId }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VerifyResponse | null>(null)
  const [error, setError] = useState('')

  async function runVerification() {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/verify-estate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId }),
      })
      const body = (await res.json()) as VerifyResponse & { error?: string }
      if (!res.ok) {
        setError(body.error ?? `Request failed (${res.status})`)
        return
      }
      setResult(body)
    } catch {
      setError('Could not run verification. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-10 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-medium text-neutral-900">Verify plan numbers</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Compare gross estate and tax estimates across your dashboard, export engine, and strategy
        horizons. Useful after updating assets or accepting advisor recommendations.
      </p>
      <button
        type="button"
        onClick={runVerification}
        disabled={loading}
        className="mt-4 inline-flex rounded-lg border border-[color:var(--mwm-navy)] px-4 py-2.5 text-sm font-medium text-[color:var(--mwm-navy)] transition hover:bg-neutral-50 disabled:opacity-60"
      >
        {loading ? 'Running…' : 'Verify my plan'}
      </button>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {result ? (
        <div className="mt-6 border-t border-neutral-100 pt-4">
          <p
            className={`text-sm font-medium ${result.passed ? 'text-[color:var(--mwm-sage)]' : 'text-red-600'}`}
          >
            {result.passed ? 'All surfaces aligned' : 'Mismatch detected — contact support if unexpected'}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs text-neutral-700">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="py-2 pr-3 font-medium">Metric</th>
                  <th className="py-2 px-2 font-medium">Cache</th>
                  <th className="py-2 px-2 font-medium">Live</th>
                  <th className="py-2 px-2 font-medium">Export</th>
                  <th className="py-2 px-2 font-medium">Today</th>
                </tr>
              </thead>
              <tbody>
                {result.matrix.map((row) => (
                  <tr key={row.metric} className="border-b border-neutral-100">
                    <td className="py-2 pr-3">{row.metric}</td>
                    <td className="py-2 px-2">{fmt(row.compositionCache)}</td>
                    <td className="py-2 px-2">{fmt(row.compositionLive)}</td>
                    <td className="py-2 px-2">{fmt(row.exportEngineB)}</td>
                    <td className="py-2 px-2">{fmt(row.horizonsToday)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
