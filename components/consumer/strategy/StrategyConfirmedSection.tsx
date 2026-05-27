'use client'

import { useState } from 'react'
import { formatDollars } from '@/lib/utils/formatCurrency'
import { deactivateStrategyLineItemById } from '@/lib/consumer/consumerStrategyLineItems'
import { strategyLabel } from '@/lib/strategy/strategyLabels'
import type { StrategyLineItemRow } from '@/lib/consumer/strategyLineItemViews'

type StrategyConfirmedSectionProps = {
  items: StrategyLineItemRow[]
  onRemove: () => void
}

export function StrategyConfirmedSection({ items, onRemove }: StrategyConfirmedSectionProps) {
  const [acting, setActing] = useState<string | null>(null)

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 px-4 py-4 text-center">
        <p className="text-xs text-gray-400">
          Strategies you add to your plan will appear here and reduce your taxable estate.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const label = strategyLabel(item.strategy_source, item.scenario_name)
        const amount = Number(item.amount ?? 0)
        const isActing = acting === item.id

        return (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50/30 px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-sm text-green-500">✓</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{label}</p>
                {item.source_role === 'advisor' && (
                  <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-600">
                    Accepted from advisor
                  </p>
                )}
                {amount > 0 && (
                  <p className="mt-0.5 text-xs text-gray-500">{formatDollars(amount)}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                setActing(item.id)
                try {
                  await deactivateStrategyLineItemById(item.id)
                  onRemove()
                } finally {
                  setActing(null)
                }
              }}
              disabled={isActing}
              className="ml-4 shrink-0 text-xs text-gray-400 transition-colors hover:text-red-500 disabled:opacity-50"
            >
              {isActing ? '…' : 'Remove'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
