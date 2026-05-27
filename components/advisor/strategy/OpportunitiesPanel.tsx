'use client'

import { useMemo } from 'react'
import type { AdvisoryMetric } from '@/lib/advisoryMetrics'
import type { AdvisorStrategyLineItemSummary } from '@/lib/estate/strategyLedger'
import { StrategyOpportunityRow } from '@/components/advisor/strategy/StrategyOpportunityRow'
import type { InlineStrategyPanelBundle } from '@/components/advisor/strategy/InlineStrategyPanel'
import {
  STRATEGY_CATALOG,
  deriveHighlightedStrategies,
} from '@/components/advisor/strategy/strategyCatalog'

interface OpportunitiesPanelProps {
  metrics: AdvisoryMetric[]
  hasRunModules: boolean
  onRunStrategyModules: () => void
  inlineStrategyId: string | null
  onInlineExpand: (catalogId: string) => void
  inlinePanelProps: InlineStrategyPanelBundle
  strategyLineItems: AdvisorStrategyLineItemSummary[]
}

export function OpportunitiesPanel({
  metrics,
  hasRunModules,
  onRunStrategyModules,
  inlineStrategyId,
  onInlineExpand,
  inlinePanelProps,
  strategyLineItems,
}: OpportunitiesPanelProps) {
  const highlightedIds = deriveHighlightedStrategies(metrics)

  const sentStrategyIds = useMemo(
    () =>
      new Set(
        strategyLineItems
          .filter(
            (r) =>
              r.source_role === 'advisor' &&
              r.is_active &&
              Math.abs(Number(r.amount ?? 0)) > 0,
          )
          .map((r) => r.strategy_source),
      ),
    [strategyLineItems],
  )

  return (
    <div className="space-y-3">
      {STRATEGY_CATALOG.slice()
        .sort((a, b) => {
          const aH = highlightedIds.has(a.id) ? 0 : 1
          const bH = highlightedIds.has(b.id) ? 0 : 1
          return aH - bH
        })
        .map((strategy) => (
          <StrategyOpportunityRow
            key={strategy.id}
            strategy={strategy}
            isHighlighted={highlightedIds.has(strategy.id)}
            isExpanded={inlineStrategyId === strategy.id}
            isSent={sentStrategyIds.has(strategy.id)}
            metrics={metrics}
            hasRunModules={hasRunModules}
            inlinePanelProps={inlinePanelProps}
            onToggle={() => onInlineExpand(strategy.id)}
          />
        ))}

      {!hasRunModules && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">
              Run strategy modules to calculate NPV for each strategy
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              Best Strategy NPV · CST Crossover Year · GRAT scenario modeling
            </p>
          </div>
          <button
            type="button"
            onClick={onRunStrategyModules}
            className="ml-4 whitespace-nowrap text-sm font-medium text-[#0F1B3C] transition-colors hover:text-[#C9A84C]"
          >
            Run modules →
          </button>
        </div>
      )}
    </div>
  )
}
