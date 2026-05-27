'use client'

import { useState } from 'react'
import { formatDollars } from '@/lib/utils/formatCurrency'
import {
  demoteStrategyFromCertain,
  returnStrategyToSandbox,
  withdrawStrategy,
} from '@/lib/consumer/consumerStrategyLineItems'
import { strategyLabel } from '@/lib/strategy/strategyLabels'
import type { StrategyLineItemRow } from '@/lib/consumer/strategyLineItemViews'
import { ReversalModal, type ReversalModalAction } from '@/components/consumer/strategy/ReversalModal'

type StrategyConfirmedSectionProps = {
  items: StrategyLineItemRow[]
  onRefresh: () => void
}

export function StrategyConfirmedSection({ items, onRefresh }: StrategyConfirmedSectionProps) {
  const [acting, setActing] = useState<string | null>(null)
  const [reversalModal, setReversalModal] = useState<{
    id: string
    name: string
    action: ReversalModalAction
  } | null>(null)

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
    <>
      <div className="space-y-2">
        {items.map((item) => {
          const label = strategyLabel(item.strategy_source, item.scenario_name)
          const amount = Number(item.amount ?? 0)
          const isConsumerOwned = item.source_role === 'consumer'
          const isCertain = item.confidence_level === 'certain'

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

              <div className="ml-4 flex shrink-0 items-center gap-3">
                {isCertain ? (
                  <button
                    type="button"
                    disabled={acting === item.id}
                    onClick={() =>
                      setReversalModal({ id: item.id, name: label, action: 'demote' })
                    }
                    className="text-xs text-amber-600 transition-colors hover:text-amber-800 disabled:opacity-50"
                  >
                    Unwind ↩
                  </button>
                ) : isConsumerOwned ? (
                  <>
                    <button
                      type="button"
                      disabled={acting === item.id}
                      onClick={() =>
                        setReversalModal({
                          id: item.id,
                          name: label,
                          action: 'return_to_sandbox',
                        })
                      }
                      className="text-xs text-[color:var(--mwm-navy)] transition-colors hover:text-[color:var(--mwm-gold)] disabled:opacity-50"
                    >
                      Return to sandbox
                    </button>
                    <button
                      type="button"
                      disabled={acting === item.id}
                      onClick={() =>
                        setReversalModal({ id: item.id, name: label, action: 'withdraw' })
                      }
                      className="text-xs text-gray-400 transition-colors hover:text-red-500 disabled:opacity-50"
                    >
                      Withdraw
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={acting === item.id}
                    onClick={() =>
                      setReversalModal({ id: item.id, name: label, action: 'withdraw' })
                    }
                    className="text-xs text-gray-400 transition-colors hover:text-red-500 disabled:opacity-50"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {reversalModal && (
        <ReversalModal
          strategyName={reversalModal.name}
          action={reversalModal.action}
          onCancel={() => setReversalModal(null)}
          onConfirm={async (reason) => {
            setActing(reversalModal.id)
            try {
              if (reversalModal.action === 'return_to_sandbox') {
                await returnStrategyToSandbox(reversalModal.id)
              } else if (reversalModal.action === 'withdraw') {
                await withdrawStrategy(reversalModal.id, reason)
              } else {
                await demoteStrategyFromCertain(reversalModal.id, reason)
              }
              setReversalModal(null)
              onRefresh()
            } finally {
              setActing(null)
            }
          }}
        />
      )}
    </>
  )
}
