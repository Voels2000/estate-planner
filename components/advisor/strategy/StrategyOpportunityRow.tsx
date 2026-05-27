'use client'

import type { AdvisoryMetric } from '@/lib/advisoryMetrics'
import { ModelStrategyButton } from '@/components/advisor/strategy/ModelStrategyButton'
import {
  getStrategyBenefit,
  type StrategyCatalogEntry,
} from '@/components/advisor/strategy/strategyCatalog'

interface StrategyOpportunityRowProps {
  strategy: StrategyCatalogEntry
  isHighlighted: boolean
  metrics: AdvisoryMetric[]
  hasRunModules: boolean
  onRunStrategyModules: () => void
}

export function StrategyOpportunityRow({
  strategy,
  isHighlighted,
  metrics,
  hasRunModules,
  onRunStrategyModules,
}: StrategyOpportunityRowProps) {
  const benefit = hasRunModules ? getStrategyBenefit(strategy.id, metrics) : null

  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-lg border px-4 py-3 ${
        isHighlighted
          ? 'border-[#0F1B3C]/20 bg-[#0F1B3C]/[0.02]'
          : 'border-gray-100 bg-white'
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${
            isHighlighted ? 'bg-[#C9A84C]' : 'bg-gray-200'
          }`}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{strategy.name}</span>
            <span className="text-xs text-gray-400">{strategy.fullName}</span>
            {isHighlighted && (
              <span className="rounded bg-[#C9A84C]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#C9A84C]">
                Relevant
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">{strategy.description}</p>
          {benefit && (
            <p className="mt-1 text-xs font-medium text-green-700">Est. benefit: {benefit}</p>
          )}
        </div>
      </div>
      <div className="flex-shrink-0">
        <ModelStrategyButton
          strategyId={strategy.id}
          hasRunModules={hasRunModules}
          onRunStrategyModules={onRunStrategyModules}
        />
      </div>
    </div>
  )
}
