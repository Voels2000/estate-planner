'use client'

import type { AdvisoryMetric } from '@/lib/advisoryMetrics'
import { CATALOG_TO_PANEL } from '@/components/advisor/strategy/catalogToPanel'
import { InlineStrategyPanel, type InlineStrategyPanelBundle } from '@/components/advisor/strategy/InlineStrategyPanel'
import {
  getStrategyBenefit,
  type StrategyCatalogEntry,
} from '@/components/advisor/strategy/strategyCatalog'
import {
  estimateStrategySavings,
  type StrategySavingsContext,
} from '@/lib/advisor/estimateStrategySavings'

interface StrategyOpportunityRowProps {
  strategy: StrategyCatalogEntry
  isHighlighted: boolean
  isExpanded: boolean
  isSent: boolean
  metrics: AdvisoryMetric[]
  hasRunModules: boolean
  savingsContext: StrategySavingsContext
  inlinePanelProps: InlineStrategyPanelBundle
  onToggle: () => void
}

export function StrategyOpportunityRow({
  strategy,
  isHighlighted,
  isExpanded,
  isSent,
  metrics,
  hasRunModules,
  savingsContext,
  inlinePanelProps,
  onToggle,
}: StrategyOpportunityRowProps) {
  const panelConfig = CATALOG_TO_PANEL[strategy.id]
  const benefit = hasRunModules ? getStrategyBenefit(strategy.id, metrics) : null
  const savings = estimateStrategySavings(strategy.id, savingsContext)

  return (
    <div
      className={`rounded-lg border transition-all duration-150 ${
        isExpanded
          ? 'border-[#0F1B3C]/30 shadow-sm'
          : isHighlighted
            ? 'border-[#0F1B3C]/20 bg-[#0F1B3C]/[0.02]'
            : 'border-gray-100 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${
              isHighlighted ? 'bg-blue-500' : 'bg-gray-200'
            }`}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">{strategy.name}</span>
              <span className="hidden text-xs text-gray-400 sm:inline">{strategy.fullName}</span>
              {isHighlighted && !isSent && (
                <span className="rounded bg-[#C9A84C]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#C9A84C]">
                  Relevant
                </span>
              )}
              {isSent && (
                <span className="rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                  ✓ Recommended
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{strategy.description}</p>
            {savings && (
              <p className="mt-1 text-[11px] font-medium text-emerald-700">{savings}</p>
            )}
            {benefit && (
              <p className="mt-1 text-xs font-medium text-green-700">Est. benefit: {benefit}</p>
            )}
          </div>
        </div>

        {panelConfig && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            className={`flex-shrink-0 whitespace-nowrap rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
              isExpanded
                ? 'border-[#0F1B3C] bg-[#0F1B3C]/5 text-[#0F1B3C]'
                : 'border-[#0F1B3C]/20 text-[#0F1B3C] hover:border-[#C9A84C]/40 hover:text-[#C9A84C]'
            }`}
          >
            {isExpanded ? 'Close ↑' : 'Model this ↓'}
          </button>
        )}
      </div>

      {isExpanded && panelConfig && (
        <div className="border-t border-[#0F1B3C]/10">
          <InlineStrategyPanel
            panel={panelConfig.panel}
            chip={panelConfig.chip}
            panelProps={inlinePanelProps}
          />
        </div>
      )}
    </div>
  )
}
