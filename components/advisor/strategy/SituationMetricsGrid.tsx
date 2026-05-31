'use client'

import { useMemo } from 'react'
import { STRATEGY_MODULE_METRIC_IDS, type AdvisoryMetric } from '@/lib/advisoryMetrics'
import type { AdvisoryMetricsInput } from '@/lib/advisoryMetrics'
import { resolveAdvisoryMetrics } from '@/lib/advisor/resolveAdvisoryMetrics'
import { AdvisoryMetricCard } from '@/components/advisor/AdvisoryMetricCard'
import {
  getActiveIndicatorMetricIds,
  getMetricSeverityForAdvisoryMetric,
  getMetricStatusLabel,
} from '@/lib/advisor/advisoryMetricSeverity'

const SITUATION_CORE_IDS = [
  'effective_rate',
  'cost_of_inaction',
  'exemption_utilization',
  'dsue_at_risk',
  'liquidity_coverage',
  'grat_breakeven',
] as const

interface SituationMetricsGridProps {
  householdId: string
  metricsInput: AdvisoryMetricsInput
  cachedCoreMetrics?: AdvisoryMetric[]
  hasRunStrategyModules?: boolean
  section7520Rate?: number
  explanationsAnchorId?: string
}

export function SituationMetricsGrid({
  householdId,
  metricsInput,
  cachedCoreMetrics,
  hasRunStrategyModules = false,
  section7520Rate = 0.052,
  explanationsAnchorId = 'strategy-metric-explanations',
}: SituationMetricsGridProps) {
  const metrics = useMemo(
    () =>
      resolveAdvisoryMetrics(metricsInput, {
        cachedCoreMetrics,
        hasRunStrategyModules,
      }),
    [cachedCoreMetrics, hasRunStrategyModules, metricsInput],
  )

  const gridMetrics = useMemo(() => {
    const ids = hasRunStrategyModules
      ? [...SITUATION_CORE_IDS, ...STRATEGY_MODULE_METRIC_IDS]
      : SITUATION_CORE_IDS
    return ids
      .map((id) => metrics.find((m) => m.id === id))
      .filter((m): m is AdvisoryMetric => Boolean(m))
  }, [metrics, hasRunStrategyModules])

  const activeIndicators = useMemo(
    () => getActiveIndicatorMetricIds(gridMetrics, { section7520Rate }),
    [gridMetrics, section7520Rate],
  )

  const gridCols = hasRunStrategyModules ? 'lg:grid-cols-4' : 'lg:grid-cols-3'

  return (
    <div data-household-id={householdId}>
      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${gridCols}`}>
        {gridMetrics.map((metric) => {
          const severity = getMetricSeverityForAdvisoryMetric(metric, { section7520Rate })
          return (
            <AdvisoryMetricCard
              key={metric.id}
              metric={metric}
              severity={severity}
              statusLabel={getMetricStatusLabel(metric, severity)}
              showIndicator={activeIndicators.has(metric.id)}
            />
          )
        })}
      </div>
      <p className="mt-3 text-xs text-gray-400">
        <a href={`#${explanationsAnchorId}`} className="text-[#0F1B3C] hover:text-[#C9A84C]">
          What do these mean?
        </a>
      </p>
    </div>
  )
}
