'use client'

import { useMemo, useState } from 'react'
import {
  calculateAdvisoryMetrics,
  STRATEGY_MODULE_METRIC_IDS,
  type AdvisoryMetric,
} from '@/lib/advisoryMetrics'
import type { AdvisoryMetricsInput } from '@/lib/advisoryMetrics'
import { getTaxScopeBadge } from '@/lib/view-models/taxScopeBadges'

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

interface MetricExplanationsAccordionProps {
  metricsInput: AdvisoryMetricsInput
  cachedCoreMetrics?: AdvisoryMetric[]
  hasRunStrategyModules?: boolean
  grossEstate: number
  estimatedFederalTax: number
  estimatedStateTax: number
  projectedGrossEstate?: number
  projectedEstimatedFederalTax?: number
  projectedEstimatedStateTax?: number
  anchorId?: string
}

export function MetricExplanationsAccordion({
  metricsInput,
  cachedCoreMetrics,
  hasRunStrategyModules = false,
  grossEstate,
  estimatedFederalTax,
  estimatedStateTax,
  projectedGrossEstate,
  projectedEstimatedFederalTax,
  projectedEstimatedStateTax,
  anchorId = 'strategy-metric-explanations',
}: MetricExplanationsAccordionProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    federal: true,
    state: false,
    both: false,
    strategy: false,
  })

  const metrics = useMemo(() => {
    if (cachedCoreMetrics && cachedCoreMetrics.length > 0) {
      if (hasRunStrategyModules) {
        const { metrics: full } = calculateAdvisoryMetrics(metricsInput, { includeStrategyModules: true })
        const moduleMetrics = full.filter((m) =>
          (STRATEGY_MODULE_METRIC_IDS as readonly string[]).includes(m.id),
        )
        return [...cachedCoreMetrics, ...moduleMetrics]
      }
      return cachedCoreMetrics
    }
    return calculateAdvisoryMetrics(metricsInput, {
      includeStrategyModules: hasRunStrategyModules,
    }).metrics
  }, [cachedCoreMetrics, hasRunStrategyModules, metricsInput])

  const groupedMetrics = useMemo(
    () => ({
      federal: metrics.filter((m) => m.scope === 'federal'),
      state: metrics.filter((m) => m.scope === 'state'),
      both: metrics.filter((m) => m.scope === 'both'),
      strategy: metrics.filter((m) => m.scope === 'strategy'),
    }),
    [metrics],
  )

  const projectedRows = useMemo(() => {
    if (
      !Number.isFinite(Number(projectedGrossEstate ?? NaN)) ||
      !Number.isFinite(Number(projectedEstimatedFederalTax ?? NaN)) ||
      !Number.isFinite(Number(projectedEstimatedStateTax ?? NaN))
    ) {
      return null
    }
    const actualCombined = estimatedFederalTax + estimatedStateTax
    const projectedCombined = Number(projectedEstimatedFederalTax) + Number(projectedEstimatedStateTax)
    return {
      grossEstate: { actual: grossEstate, projected: Number(projectedGrossEstate) },
      federalTax: { actual: estimatedFederalTax, projected: Number(projectedEstimatedFederalTax) },
      stateTax: { actual: estimatedStateTax, projected: Number(projectedEstimatedStateTax) },
      combinedTax: { actual: actualCombined, projected: projectedCombined },
    }
  }, [
    grossEstate,
    estimatedFederalTax,
    estimatedStateTax,
    projectedGrossEstate,
    projectedEstimatedFederalTax,
    projectedEstimatedStateTax,
  ])

  function getProjectedRow(metricId: string): { actual: number; projected: number } | null {
    if (!projectedRows) return null
    if (metricId === 'gross_estate') return projectedRows.grossEstate
    if (metricId === 'federal_tax_exposure') return projectedRows.federalTax
    if (metricId === 'state_tax_exposure') return projectedRows.stateTax
    if (metricId === 'combined_tax_burden') return projectedRows.combinedTax
    return null
  }

  return (
    <div id={anchorId} className="overflow-hidden rounded-lg border border-gray-200">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          Metric Explanations
        </h4>
      </div>
      <div className="divide-y divide-gray-100">
        {(
          [
            ['both', 'Combined Tax'],
            ['federal', 'Federal Tax'],
            ['state', 'State Tax'],
            ['strategy', 'Strategy'],
          ] as const
        ).map(([scope, label]) => (
          <div key={scope}>
            <button
              type="button"
              onClick={() => setOpenGroups((s) => ({ ...s, [scope]: !s[scope] }))}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50"
            >
              <span className="text-sm font-semibold text-gray-800">{label}</span>
              <span className="text-xs text-gray-500">{openGroups[scope] ? '▲' : '▼'}</span>
            </button>
            {openGroups[scope] && (
              <div className="border-t border-gray-100">
                {groupedMetrics[scope].length === 0 && (
                  <p className="px-4 py-3 text-xs text-gray-400">No metrics in this group.</p>
                )}
                {groupedMetrics[scope].map((metric) => {
                  const scopeBadge = getTaxScopeBadge(metric.scope)
                  const projected = getProjectedRow(metric.id)
                  return (
                    <div key={metric.id} className="border-t border-gray-50 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">{metric.label}</span>
                          <span
                            className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${scopeBadge.className}`}
                          >
                            {scopeBadge.label}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{metric.value}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{metric.detail}</p>
                      {projected && (
                        <div className="mt-2 grid grid-cols-3 gap-2 rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-[11px]">
                          <div>
                            <span className="block text-slate-500">Actual</span>
                            <span className="font-medium text-slate-900">
                              {MONEY.format(projected.actual)}
                            </span>
                          </div>
                          <div>
                            <span className="block text-slate-500">Projected</span>
                            <span className="font-medium text-slate-900">
                              {MONEY.format(projected.projected)}
                            </span>
                          </div>
                          <div>
                            <span className="block text-slate-500">Delta</span>
                            <span
                              className={`font-medium ${projected.projected - projected.actual <= 0 ? 'text-green-700' : 'text-amber-700'}`}
                            >
                              {MONEY.format(projected.projected - projected.actual)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
