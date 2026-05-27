export type AssetBand = '2m-5m' | '5m-10m' | '10m-20m' | '20m-30m'
export type AgeBand = '40-50' | '50-60' | '60-70' | '70+'

export interface BenchmarkRange {
  p25: number
  p50: number
  p75: number
  label: string
}

/** Placeholder peer ranges — hidden until ADVISOR_BENCHMARKS flag and real data exist. */
export const BENCHMARK_RANGES: Record<string, Record<string, BenchmarkRange>> = {
  exemptionUtilization: {
    '5m-10m_60-70': { p25: 20, p50: 45, p75: 70, label: '$5M–$10M estate, age 60–70' },
    '2m-5m_50-60': { p25: 15, p50: 35, p75: 60, label: '$2M–$5M estate, age 50–60' },
  },
  effectiveEstateTaxRate: {
    '5m-10m_60-70': { p25: 0, p50: 6, p75: 11, label: '$5M–$10M estate, age 60–70' },
  },
}

export function getBandKey(assetBand: AssetBand, ageBand: AgeBand): string {
  return `${assetBand}_${ageBand}`
}

export function getPercentileLabel(
  value: number,
  range: BenchmarkRange,
): 'bottom' | 'middle' | 'top' {
  if (value <= range.p25) return 'bottom'
  if (value <= range.p75) return 'middle'
  return 'top'
}

export function getBenchmarkRange(
  metricKey: string,
  bandKey: string,
): BenchmarkRange | null {
  return BENCHMARK_RANGES[metricKey]?.[bandKey] ?? null
}
