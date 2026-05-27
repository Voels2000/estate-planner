'use client'

import type { AdvisoryMetric } from '@/lib/advisoryMetrics'
import { StrategyOpportunityRow } from '@/components/advisor/strategy/StrategyOpportunityRow'
import {
  STRATEGY_CATALOG,
  deriveHighlightedStrategies,
} from '@/components/advisor/strategy/strategyCatalog'

interface OpportunitiesPanelProps {
  metrics: AdvisoryMetric[]
  hasRunModules: boolean
  onRunStrategyModules: () => void
}

export function OpportunitiesPanel({
  metrics,
  hasRunModules,
  onRunStrategyModules,
}: OpportunitiesPanelProps) {
  const highlightedIds = deriveHighlightedStrategies(metrics)

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
            metrics={metrics}
            hasRunModules={hasRunModules}
            onRunStrategyModules={onRunStrategyModules}
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
