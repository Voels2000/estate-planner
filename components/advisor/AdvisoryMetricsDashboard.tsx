'use client'

// Sprint 72 — AdvisoryMetricsDashboard
// 8-metric panel for advisor StrategyTab
// Sunset urgency countdown engine
// Consumer shareable readiness score placeholder

import { useMemo } from 'react'
import { calculateAdvisoryMetrics, AdvisoryMetricsInput } from '@/lib/advisoryMetrics'

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
}

const CURRENT_YEAR = new Date().getFullYear()
/** TCJA estate exemption reversion date is Dec 31 of this year (see advisoryMetrics sunset messaging). */
const SUNSET_YEAR = 2025
const SUNSET_EXEMPTION = 7_000_000
const DEFAULT_7520_RATE = 0.052

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

const URGENCY_COLORS = {
  low: 'bg-blue-50 border-blue-200',
  medium: 'bg-amber-50 border-amber-200',
  high: 'bg-orange-50 border-orange-200',
  critical: 'bg-red-50 border-red-200',
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`

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
}: AdvisoryMetricsDashboardProps) {
  const input: AdvisoryMetricsInput = {
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
    survivorExemption: federalExemption,
    currentYear: CURRENT_YEAR,
    sunsetYear: SUNSET_YEAR,
    sunsetExemption: SUNSET_EXEMPTION,
  }

  const { metrics, sunsetUrgency } = useMemo(
    () => calculateAdvisoryMetrics(input),
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
    ],
  )

  return (
    <div className="space-y-6" data-household-id={householdId}>
      {/* Sunset Urgency Banner */}
      {sunsetUrgency.exposureAtSunset > 0 && (
        <div className={`border rounded-lg p-4 ${URGENCY_COLORS[sunsetUrgency.urgencyLevel]}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                ⏰ Sunset Urgency — {sunsetUrgency.daysRemaining} days remaining
              </p>
              <p className="text-xs text-gray-600">{sunsetUrgency.message}</p>
            </div>
            <div className="text-right ml-4 shrink-0">
              <div className="text-lg font-bold text-red-700">{fmt(sunsetUrgency.exposureAtSunset)}</div>
              <div className="text-xs text-gray-500">sunset exposure</div>
            </div>
          </div>
          {/* Countdown bar */}
          <div className="mt-3">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  sunsetUrgency.urgencyLevel === 'critical'
                    ? 'bg-red-500'
                    : sunsetUrgency.urgencyLevel === 'high'
                      ? 'bg-orange-500'
                      : sunsetUrgency.urgencyLevel === 'medium'
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                }`}
                style={{
                  width: `${Math.max(2, Math.min(100, (sunsetUrgency.daysRemaining / 730) * 100))}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Today</span>
              <span>{sunsetUrgency.sunsetDate}</span>
            </div>
          </div>
        </div>
      )}

      {/* No sunset exposure — informational banner */}
      {sunsetUrgency.exposureAtSunset === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-700">ℹ️ {sunsetUrgency.message}</p>
        </div>
      )}

      {/* 8-Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            className={`border rounded-lg p-4 ${STATUS_COLORS[metric.status]}`}
            title={metric.detail}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-medium text-gray-600 leading-tight">{metric.label}</span>
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
        ))}
      </div>

      {/* Metric Detail Accordion */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Metric Explanations
          </h4>
        </div>
        <div className="divide-y divide-gray-100">
          {metrics.map((metric) => (
            <div key={metric.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">{metric.label}</span>
                <span className="text-sm font-semibold text-gray-900">{metric.value}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{metric.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
