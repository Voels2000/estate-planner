'use client'

import { useState } from 'react'
import { formatDollars } from '@/lib/utils/formatCurrency'
import {
  deactivateStrategyLineItemById,
  promoteStrategyToProbable,
} from '@/lib/consumer/consumerStrategyLineItems'
import { strategyLabel } from '@/lib/strategy/strategyLabels'
import type { StrategyLineItemRow } from '@/lib/consumer/strategyLineItemViews'

type StrategySandboxSectionProps = {
  householdId: string
  items: StrategyLineItemRow[]
  onAction: () => void
}

export function StrategySandboxSection({
  householdId,
  items,
  onAction,
}: StrategySandboxSectionProps) {
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handlePromote(item: StrategyLineItemRow) {
    setActing(item.id)
    setError(null)
    try {
      if (item.source_role === 'advisor') {
        const res = await fetch('/api/consumer/strategy-recommendation', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lineItemId: item.id, householdId }),
        })
        if (!res.ok) throw new Error('Failed to accept recommendation')
      } else {
        await promoteStrategyToProbable(item.id)
      }
      onAction()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setActing(null)
    }
  }

  async function handleDecline(item: StrategyLineItemRow) {
    setActing(item.id)
    setError(null)
    try {
      if (item.source_role === 'advisor') {
        const res = await fetch('/api/consumer/strategy-recommendation', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lineItemId: item.id, householdId }),
        })
        if (!res.ok) throw new Error('Failed to decline recommendation')
      } else {
        await deactivateStrategyLineItemById(item.id)
      }
      onAction()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setActing(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center">
        <p className="text-sm text-gray-500">No strategies in your sandbox yet.</p>
        <p className="mt-1 text-xs text-gray-400">
          Model a strategy below to explore its impact before adding it to your plan.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {items.map((item) => {
        const isAdvisor = item.source_role === 'advisor'
        const label = strategyLabel(item.strategy_source, item.scenario_name)
        const isActing = acting === item.id
        const amount = Number(item.amount ?? 0)

        return (
          <div
            key={item.id}
            className={`flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
              isAdvisor ? 'border-blue-200 bg-blue-50/40' : 'border-amber-200 bg-amber-50/30'
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  isAdvisor ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {isAdvisor ? 'Advisor' : 'You modeled'}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{label}</p>
                {amount > 0 && (
                  <p className="mt-0.5 text-xs text-gray-500">{formatDollars(amount)}</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:ml-4">
              <button
                type="button"
                onClick={() => void handlePromote(item)}
                disabled={isActing}
                className="rounded border border-[color:var(--mwm-navy)]/20 px-3 py-1.5 text-xs font-medium text-[color:var(--mwm-navy)] transition-colors hover:border-[color:var(--mwm-gold)]/40 hover:text-[color:var(--mwm-gold)] disabled:opacity-50"
              >
                {isActing ? '…' : isAdvisor ? 'Accept' : 'Add to plan'}
              </button>
              <button
                type="button"
                onClick={() => void handleDecline(item)}
                disabled={isActing}
                className="text-xs text-gray-400 transition-colors hover:text-red-500 disabled:opacity-50"
              >
                {isAdvisor ? 'Decline' : 'Remove'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
