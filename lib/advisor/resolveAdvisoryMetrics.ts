import {
  calculateAdvisoryMetrics,
  STRATEGY_MODULE_METRIC_IDS,
  type AdvisoryMetric,
} from '@/lib/advisoryMetrics'
import type { AdvisoryMetricsInput } from '@/lib/advisoryMetrics'

export function resolveAdvisoryMetrics(
  metricsInput: AdvisoryMetricsInput,
  options: {
    cachedCoreMetrics?: AdvisoryMetric[]
    hasRunStrategyModules?: boolean
  } = {},
): AdvisoryMetric[] {
  const { cachedCoreMetrics, hasRunStrategyModules = false } = options
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
}
