'use client'

// Sprint 72 — AdvisoryMetricsDashboard
// 8-metric panel for advisor StrategyTab
// Consumer shareable readiness score placeholder

import { useMemo, useState } from 'react'
import { calculateAdvisoryMetrics } from '@/lib/advisoryMetrics'
import { getTaxScopeBadge } from '@/lib/view-models/taxScopeBadges'

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
}
const DEFAULT_7520_RATE = 0.052
const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const STATUS_COLORS = {
  good: 'bg-green-50 border-green-200 text-green-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  critical: 'bg-red-50 border-red-200 text-red-800',
  neutral: 'bg-gray-50 border-gray-200 text-gray-700',
}

const STATUS_BADGE = {
  good: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
  neutral: 'bg-gray-100 text-gray-600',
}

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
}: AdvisoryMetricsDashboardProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    federal: true,
    state: false,
    both: false,
    strategy: false,
  })
  const { metrics } = useMemo(
    () => calculateAdvisoryMetrics({
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

  return (
    <div className="space-y-6" data-household-id={householdId}>
      {/* 8-Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((metric) => (
          (() => {
            const scopeBadge = getTaxScopeBadge(metric.scope)
            return (
          <div
            key={metric.id}
            className={`border rounded-lg p-4 ${STATUS_COLORS[metric.status]}`}
            title={metric.detail}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="space-y-1">
                <span className="block text-xs font-medium text-gray-600 leading-tight">{metric.label}</span>
                <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${scopeBadge.className}`}>
                  {scopeBadge.label}
                </span>
              </div>
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-medium ml-2 shrink-0 ${STATUS_BADGE[metric.status]}`}
              >
                {metric.status === 'good'
                  ? '✓'
                  : metric.status === 'warning'
                    ? '!'
                    : metric.status === 'critical'
                      ? '!!'
                      : '—'}
              </span>
            </div>
            <div className="text-xl font-bold text-gray-900 mb-1">{metric.value}</div>
            <div className="text-xs text-gray-500 leading-tight">{metric.subtext}</div>
          </div>
            )
          })()
        ))}
      </div>

      {/* Metric Detail Rollups */}
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
