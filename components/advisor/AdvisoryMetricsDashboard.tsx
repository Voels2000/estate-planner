'use client'

// Sprint 72 — AdvisoryMetricsDashboard
// Advisory metric cards for advisor StrategyTab

import { useMemo, useState } from 'react'
import {
  calculateAdvisoryMetrics,
  STRATEGY_MODULE_METRIC_IDS,
  type AdvisoryMetric,
} from '@/lib/advisoryMetrics'
import type { AdvisoryMetricsInput } from '@/lib/advisoryMetrics'
import { getTaxScopeBadge } from '@/lib/view-models/taxScopeBadges'
import { AdvisoryMetricCard } from '@/components/advisor/AdvisoryMetricCard'
import {
  getActiveIndicatorMetricIds,
  getMetricSeverityForAdvisoryMetric,
} from '@/lib/advisor/advisoryMetricSeverity'

interface AdvisoryMetricsDashboardProps {
  householdId: string
  grossEstate: number
  federalExemption: number
  estimatedFederalTax: number
  estimatedStateTax: number
  hasSpouse: boolean
  liquidAssets?: number
  ilitDeathBenefit?: number
  section7520Rate?: number
  cstFundingAmount?: number
  cstGrowthRate?: number
  noExemptionStressTax?: number
  projectedGrossEstate?: number
  projectedEstimatedFederalTax?: number
  projectedEstimatedStateTax?: number
  /** Pre-computed core metrics from server cache (Strategy tab). */
  cachedCoreMetrics?: AdvisoryMetric[]
  hasRunStrategyModules?: boolean
  onRunStrategyModules?: () => void
}

const DEFAULT_7520_RATE = 0.052
const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export default function AdvisoryMetricsDashboard({
  householdId,
  grossEstate,
  federalExemption,
  estimatedFederalTax,
  estimatedStateTax,
  hasSpouse,
  liquidAssets = grossEstate * 0.3,
  ilitDeathBenefit = 0,
  section7520Rate = DEFAULT_7520_RATE,
  cstFundingAmount,
  cstGrowthRate = 0.06,
  noExemptionStressTax,
  projectedGrossEstate,
  projectedEstimatedFederalTax,
  projectedEstimatedStateTax,
  cachedCoreMetrics,
  hasRunStrategyModules = false,
  onRunStrategyModules,
}: AdvisoryMetricsDashboardProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    federal: true,
    state: false,
    both: false,
    strategy: false,
  })

  const metricsInput: AdvisoryMetricsInput = useMemo(
    () => ({
      grossEstate,
      federalExemption,
      federalTax: estimatedFederalTax,
      stateTax: estimatedStateTax,
      hasSpouse,
      dsueAvailable: hasSpouse ? federalExemption : 0,
      liquidAssets,
      ilitDeathBenefit,
      section7520Rate,
      cstFundingAmount,
      cstGrowthRate,
      noExemptionStressTax,
      survivorExemption: federalExemption,
    }),
    [
      grossEstate,
      federalExemption,
      estimatedFederalTax,
      estimatedStateTax,
      hasSpouse,
      liquidAssets,
      ilitDeathBenefit,
      section7520Rate,
      cstFundingAmount,
      cstGrowthRate,
      noExemptionStressTax,
    ],
  )

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
    const { metrics: computed } = calculateAdvisoryMetrics(metricsInput, {
      includeStrategyModules: hasRunStrategyModules,
    })
    if (!hasRunStrategyModules) {
      return computed.filter(
        (m) => !(STRATEGY_MODULE_METRIC_IDS as readonly string[]).includes(m.id),
      )
    }
    return computed
  }, [cachedCoreMetrics, hasRunStrategyModules, metricsInput])

  const activeWarnings = useMemo(
    () => getActiveIndicatorMetricIds(metrics, { section7520Rate }),
    [metrics, section7520Rate],
  )

  const gridMetrics = useMemo(
    () =>
      hasRunStrategyModules
        ? metrics
        : metrics.filter(
            (m) => !(STRATEGY_MODULE_METRIC_IDS as readonly string[]).includes(m.id),
          ),
    [metrics, hasRunStrategyModules],
  )

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
      grossEstate: {
        actual: grossEstate,
        projected: Number(projectedGrossEstate),
      },
      federalTax: {
        actual: estimatedFederalTax,
        projected: Number(projectedEstimatedFederalTax),
      },
      stateTax: {
        actual: estimatedStateTax,
        projected: Number(projectedEstimatedStateTax),
      },
      combinedTax: {
        actual: actualCombined,
        projected: projectedCombined,
      },
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

  const gridCols = hasRunStrategyModules ? 'lg:grid-cols-4' : 'lg:grid-cols-3'

  return (
    <div className="space-y-6" data-household-id={householdId}>
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${gridCols} gap-3`}>
        {gridMetrics.map((metric) => (
          <AdvisoryMetricCard
            key={metric.id}
            metric={metric}
            severity={getMetricSeverityForAdvisoryMetric(metric, { section7520Rate })}
            showIndicator={activeWarnings.has(metric.id)}
          />
        ))}
      </div>

      {!hasRunStrategyModules && (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">
              2 strategy metrics unlock when you run strategy modules
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Best Strategy NPV · CST Crossover Year</p>
          </div>
          <button
            type="button"
            onClick={onRunStrategyModules}
            className="text-sm font-medium text-[color:var(--mwm-navy)] hover:text-[color:var(--mwm-gold)] transition-colors whitespace-nowrap"
          >
            Run strategy modules →
          </button>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Metric Explanations
          </h4>
        </div>
        <div className="divide-y divide-gray-100">
          {([
            ['both', 'Combined Tax'],
            ['federal', 'Federal Tax'],
            ['state', 'State Tax'],
            ['strategy', 'Strategy'],
          ] as const).map(([scope, label]) => (
            <div key={scope}>
              <button
                type="button"
                onClick={() => setOpenGroups((s) => ({ ...s, [scope]: !s[scope] }))}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50"
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
                      <div key={metric.id} className="px-4 py-3 border-t border-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800">{metric.label}</span>
                            <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${scopeBadge.className}`}>
                              {scopeBadge.label}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-gray-900">{metric.value}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{metric.detail}</p>
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
                              <span className={`font-medium ${projected.projected - projected.actual <= 0 ? 'text-green-700' : 'text-amber-700'}`}>
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
    </div>
  )
}
