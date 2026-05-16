'use client'

// StrategyRecommendationPanel — Session 97 / Sprint 100
// Consumer-facing panel showing pending advisor strategy recommendations.
// Displayed on the dashboard when the consumer has unreviewed advisor items.
// Allows Accept and Reject per recommendation.
// Accepted items flow into the consumer estate model via consumer_accepted=true.

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STRATEGY_LABELS: Record<string, string> = {
  annual_gifting: 'Annual Gifting Program',
  gifting: 'Annual Gifting Program',
  slat: 'Spousal Lifetime Access Trust (SLAT)',
  ilit: 'Irrevocable Life Insurance Trust (ILIT)',
  grat: 'Grantor Retained Annuity Trust (GRAT)',
  crt: 'Charitable Remainder Trust (CRT)',
  clat: 'Charitable Lead Annuity Trust (CLAT)',
  daf: 'Donor-Advised Fund (DAF)',
  roth: 'Roth Conversion',
  liquidity: 'Estate Liquidity Planning',
  cst: 'Credit Shelter Trust (CST)',
  credit_shelter_trust: 'Credit Shelter Trust (CST)',
  revocable_trust: 'Revocable Living Trust',
}

function strategyLabel(source: string, scenarioName: string | null): string {
  return scenarioName?.trim() || STRATEGY_LABELS[source] || source.replace(/_/g, ' ')
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)

export type AdvisorRecommendationItem = {
  id: string
  strategy_source: string
  amount: number
  sign: number
  scenario_name: string | null
  consumer_accepted: boolean
  consumer_rejected: boolean
}

interface StrategyRecommendationPanelProps {
  householdId: string
  items: AdvisorRecommendationItem[]
}

export default function StrategyRecommendationPanel({
  householdId,
  items,
}: StrategyRecommendationPanelProps) {
  const router = useRouter()
  const [localItems, setLocalItems] = useState<AdvisorRecommendationItem[]>(items)
  const [actionSaving, setActionSaving] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  async function fireRecompute() {
    try {
      await fetch('/api/recompute-estate-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId }),
      })
    } catch {
      // non-fatal
    }
  }

  async function handleAccept(item: AdvisorRecommendationItem) {
    setActionSaving(item.id)
    setActionMessage(null)
    try {
      const res = await fetch('/api/consumer/strategy-recommendation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineItemId: item.id, householdId }),
      })
      if (res.ok) {
        setLocalItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, consumer_accepted: true } : i)),
        )
        setActionMessage(`"${strategyLabel(item.strategy_source, item.scenario_name)}" added to your plan.`)
        router.refresh()
        void fireRecompute()
      } else {
        setActionMessage('Failed to accept — please try again.')
      }
    } catch {
      setActionMessage('Unexpected error — please try again.')
    } finally {
      setActionSaving(null)
    }
  }

  async function handleReject(item: AdvisorRecommendationItem) {
    setActionSaving(item.id)
    setActionMessage(null)
    try {
      const res = await fetch('/api/consumer/strategy-recommendation', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineItemId: item.id, householdId }),
      })
      if (res.ok) {
        setLocalItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, consumer_rejected: true } : i)),
        )
        setActionMessage(`"${strategyLabel(item.strategy_source, item.scenario_name)}" declined.`)
        router.refresh()
        void fireRecompute()
      } else {
        setActionMessage('Failed to decline — please try again.')
      }
    } catch {
      setActionMessage('Unexpected error — please try again.')
    } finally {
      setActionSaving(null)
    }
  }

  const pending = localItems.filter((i) => !i.consumer_accepted && !i.consumer_rejected)
  const accepted = localItems.filter((i) => i.consumer_accepted)
  const rejected = localItems.filter((i) => i.consumer_rejected)

  if (localItems.length === 0) return null

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-blue-900">Advisor Recommendations</h2>
          <p className="text-sm text-blue-700 mt-0.5">
            {pending.length > 0
              ? `Your advisor has ${pending.length} strategy recommendation${pending.length > 1 ? 's' : ''} for you to review.`
              : 'All recommendations have been reviewed.'}
          </p>
        </div>
        {pending.length > 0 && (
          <span className="shrink-0 rounded-full bg-blue-600 text-white text-xs font-semibold px-2.5 py-1">
            {pending.length} pending
          </span>
        )}
      </div>

      {actionMessage && <p className="text-sm text-blue-800 font-medium">{actionMessage}</p>}

      {pending.length > 0 && (
        <div className="space-y-3">
          {pending.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-blue-200 bg-white px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {strategyLabel(item.strategy_source, item.scenario_name)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Est. estate reduction:{' '}
                  <span className="font-medium text-green-700">
                    {item.sign < 0 ? '−' : '+'}
                    {fmt(Math.abs(item.amount))}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleAccept(item)}
                  disabled={actionSaving === item.id}
                  className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionSaving === item.id ? 'Saving…' : 'Accept'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleReject(item)}
                  disabled={actionSaving === item.id}
                  className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {accepted.length > 0 && (
        <div className="border-t border-blue-200 pt-3">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
            Added to your plan
          </p>
          <div className="space-y-1.5">
            {accepted.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">
                  {strategyLabel(item.strategy_source, item.scenario_name)}
                </span>
                <span className="text-green-700 font-medium text-xs">
                  ✓ Accepted — {item.sign < 0 ? '−' : '+'}
                  {fmt(Math.abs(item.amount))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {rejected.length > 0 && (
        <div className="border-t border-blue-200 pt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Declined</p>
          <div className="space-y-1.5">
            {rejected.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-400 line-through">
                  {strategyLabel(item.strategy_source, item.scenario_name)}
                </span>
                <span className="text-gray-400 text-xs">Declined</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
