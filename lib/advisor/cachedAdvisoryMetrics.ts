import { unstable_cache } from 'next/cache'
import {
  calculateAdvisoryMetrics,
  type AdvisoryMetric,
  type AdvisoryMetricsInput,
} from '@/lib/advisoryMetrics'

/**
 * Server-side cache for the six core advisory metrics (excludes strategy-module NPV / CST crossover).
 * Invalidated via `household-metrics-${householdId}` tag on household writes.
 */
export async function getCachedAdvisoryMetrics(
  householdId: string,
  cacheVersion: string,
  input: AdvisoryMetricsInput,
): Promise<AdvisoryMetric[]> {
  const cached = unstable_cache(
    async () => {
      const { metrics } = calculateAdvisoryMetrics(input, { includeStrategyModules: false })
      return metrics
    },
    ['advisory-metrics-v1', householdId, cacheVersion],
    {
      revalidate: 120,
      tags: [`household-metrics-${householdId}`],
    },
  )
  return cached()
}
