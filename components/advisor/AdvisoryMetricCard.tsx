'use client'

import type { AdvisoryMetric } from '@/lib/advisoryMetrics'
import {
  SEVERITY_CONFIG,
  type MetricSeverity,
} from '@/lib/advisor/advisoryMetricSeverity'
import { getTaxScopeBadge } from '@/lib/view-models/taxScopeBadges'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { BenchmarkBadge } from '@/components/advisor/strategy/BenchmarkBadge'
import type { BenchmarkRange } from '@/lib/advisor/benchmarks'

export interface AdvisoryMetricCardProps {
  metric: AdvisoryMetric
  severity: MetricSeverity
  showIndicator: boolean
  benchmarkRange?: BenchmarkRange | null
  benchmarkNumericValue?: number | null
}

export function AdvisoryMetricCard({
  metric,
  severity,
  showIndicator,
  benchmarkRange,
  benchmarkNumericValue,
}: AdvisoryMetricCardProps) {
  const config = SEVERITY_CONFIG[severity]
  const scopeBadge = getTaxScopeBadge(metric.scope)

  return (
    <div
      className={`rounded-lg border p-4 ${config.cardBorder} ${config.cardBg}`}
      title={metric.detail}
    >
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500">{metric.label}</p>
          <span
            className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${scopeBadge.className}`}
          >
            {scopeBadge.label}
          </span>
        </div>
        {showIndicator && (
          <span className={`text-sm font-bold ${config.indicatorClass}`}>{config.indicator}</span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{metric.value}</p>
      <p className="mt-1 text-xs text-gray-500">{metric.subtext}</p>
      {FEATURE_FLAGS.ADVISOR_BENCHMARKS && benchmarkRange && benchmarkNumericValue != null && (
        <div className="mt-2">
          <BenchmarkBadge value={benchmarkNumericValue} range={benchmarkRange} />
        </div>
      )}
    </div>
  )
}
