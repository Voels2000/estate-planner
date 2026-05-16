'use client'

// MonteCarloScenarioBanner — Session 98 / Sprint 101
// Consumer-facing Monte Carlo assumption scenario acceptance.
// Shown on dashboard and my-estate-strategy page.
// Calls /api/monte-carlo/advisor-assumptions for GET (load) and PATCH (accept/revert).

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MONTE_CARLO_SYSTEM_DEFAULTS } from '@/lib/calculations/monteCarlo'
import type { ConsumerMCAssumptionSet, ConsumerMCScenario } from '@/lib/monte-carlo/consumerAssumptionScenarios'

const FIELD_LABELS: Array<{ key: keyof ConsumerMCAssumptionSet; label: string; unit: string }> = [
  { key: 'returnMeanPct', label: 'Expected Return', unit: '%' },
  { key: 'volatilityPct', label: 'Volatility', unit: '%' },
  { key: 'withdrawalRatePct', label: 'Withdrawal Rate', unit: '%' },
  { key: 'successThreshold', label: 'Success Target', unit: '%' },
  { key: 'planningHorizonYr', label: 'Horizon', unit: ' yrs' },
  { key: 'inflationRatePct', label: 'Inflation', unit: '%' },
]

function fmt(n: number, unit: string) {
  return `${n}${unit}`
}

function isDifferentFromDefault(key: keyof ConsumerMCAssumptionSet, value: number): boolean {
  return value !== MONTE_CARLO_SYSTEM_DEFAULTS[key]
}

interface MonteCarloScenarioBannerProps {
  acceptedScenario?: ConsumerMCScenario | null
  latestSharedScenario?: ConsumerMCScenario | null
}

export default function MonteCarloScenarioBanner({
  acceptedScenario: initialAccepted,
  latestSharedScenario: initialShared,
}: MonteCarloScenarioBannerProps) {
  const router = useRouter()
  const [acceptedScenario, setAcceptedScenario] = useState<ConsumerMCScenario | null>(
    initialAccepted ?? null,
  )
  const [sharedScenario, setSharedScenario] = useState<ConsumerMCScenario | null>(
    initialShared ?? null,
  )
  const [loading, setLoading] = useState(
    initialAccepted === undefined && initialShared === undefined,
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [showReview, setShowReview] = useState(false)

  useEffect(() => {
    if (initialAccepted !== undefined || initialShared !== undefined) return
    fetch('/api/monte-carlo/advisor-assumptions')
      .then((r) => r.json())
      .then((d) => {
        setAcceptedScenario(d.acceptedScenario ?? null)
        setSharedScenario(d.latestSharedScenario ?? null)
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [initialAccepted, initialShared])

  async function handleAccept(scenarioId: string) {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/monte-carlo/advisor-assumptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', scenarioId }),
      })
      const data = await res.json()
      if (res.ok) {
        setAcceptedScenario(data.acceptedScenario)
        setSharedScenario(null)
        setShowReview(false)
        setMessage(`"${data.acceptedScenario.scenarioName}" is now applied to your projections.`)
        router.refresh()
      } else {
        setMessage(data.error ?? 'Failed to accept — please try again.')
      }
    } catch {
      setMessage('Unexpected error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRevert() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/monte-carlo/advisor-assumptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revert' }),
      })
      const data = await res.json()
      if (res.ok) {
        setAcceptedScenario(null)
        setShowReview(false)
        setMessage('Reverted to system default assumptions.')
        router.refresh()
      } else {
        setMessage(data.error ?? 'Failed to revert — please try again.')
      }
    } catch {
      setMessage('Unexpected error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  const hasPending = !!sharedScenario && !acceptedScenario
  const hasAccepted = !!acceptedScenario
  if (!hasPending && !hasAccepted) return null

  if (hasPending && sharedScenario) {
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-indigo-900">
              New Monte Carlo scenario from your advisor
            </p>
            <p className="text-xs text-indigo-700 mt-0.5">
              Your advisor has shared &ldquo;{sharedScenario.scenarioName}&rdquo; for you to review.
              Accept to apply these assumptions to your projections.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-indigo-600 text-white text-xs font-semibold px-2.5 py-1">
            Review
          </span>
        </div>

        {message && <p className="text-sm text-indigo-800 font-medium">{message}</p>}

        {!showReview ? (
          <button
            type="button"
            onClick={() => setShowReview(true)}
            className="text-sm font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
          >
            See what changes →
          </button>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  System Defaults
                </p>
                <div className="space-y-1.5">
                  {FIELD_LABELS.map(({ key, label, unit }) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-gray-600">{label}</span>
                      <span className="font-medium text-gray-800">
                        {fmt(MONTE_CARLO_SYSTEM_DEFAULTS[key] as number, unit)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">
                  {sharedScenario.scenarioName}
                </p>
                <div className="space-y-1.5">
                  {FIELD_LABELS.map(({ key, label, unit }) => {
                    const val = sharedScenario.assumptions[key] as number
                    const differs = isDifferentFromDefault(key, val)
                    return (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-600">{label}</span>
                        <span
                          className={`font-medium ${differs ? 'text-indigo-800 font-semibold' : 'text-gray-800'}`}
                        >
                          {fmt(val, unit)}
                          {differs && <span className="ml-1 text-indigo-500 text-xs">↑</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => void handleAccept(sharedScenario.id)}
                disabled={saving}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Accept & Apply'}
              </button>
              <button
                type="button"
                onClick={() => setShowReview(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Keep defaults
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (hasAccepted && acceptedScenario) {
    return (
      <div className="rounded-xl border border-indigo-200 bg-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-800">
            <span className="inline-flex items-center gap-1.5 mr-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              Advisor scenario active:
            </span>
            <span className="font-semibold text-indigo-800">{acceptedScenario.scenarioName}</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Your Monte Carlo projections are using advisor-recommended assumptions.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!showReview && (
            <button
              type="button"
              onClick={() => setShowReview(true)}
              className="text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
            >
              View details
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleRevert()}
            disabled={saving}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? 'Reverting…' : 'Use defaults'}
          </button>
        </div>

        {message && <p className="text-xs text-gray-600 mt-1 sm:mt-0">{message}</p>}

        {showReview && (
          <div className="w-full border-t border-gray-100 pt-3 mt-1">
            <div className="grid grid-cols-2 gap-3 max-w-md">
              {FIELD_LABELS.map(({ key, label, unit }) => {
                const val = acceptedScenario.assumptions[key] as number
                const differs = isDifferentFromDefault(key, val)
                return (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-gray-500">{label}</span>
                    <span className={differs ? 'font-semibold text-indigo-700' : 'text-gray-700'}>
                      {fmt(val, unit)}
                      {differs ? ' ↑' : ''}
                    </span>
                  </div>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => setShowReview(false)}
              className="mt-2 text-xs text-gray-400 hover:text-gray-600"
            >
              Hide details
            </button>
          </div>
        )}
      </div>
    )
  }

  return null
}
