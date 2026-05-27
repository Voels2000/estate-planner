import type { AdvisoryMetric } from '@/lib/advisoryMetrics'

export type MetricSeverity = 'critical' | 'warning' | 'ok' | 'neutral'

export const SEVERITY_CONFIG: Record<
  MetricSeverity,
  {
    indicator: string
    cardBorder: string
    cardBg: string
    indicatorClass: string
  }
> = {
  critical: {
    indicator: '●',
    cardBorder: 'border-red-200',
    cardBg: 'bg-red-50',
    indicatorClass: 'text-red-500',
  },
  warning: {
    indicator: '!',
    cardBorder: 'border-amber-200',
    cardBg: 'bg-amber-50/60',
    indicatorClass: 'text-amber-500',
  },
  ok: {
    indicator: '✓',
    cardBorder: 'border-green-200',
    cardBg: 'bg-green-50/40',
    indicatorClass: 'text-green-500',
  },
  neutral: {
    indicator: '—',
    cardBorder: 'border-gray-200',
    cardBg: 'bg-white',
    indicatorClass: 'text-gray-300',
  },
}

const METRIC_ID_TO_SEVERITY_KEY: Record<string, string> = {
  effective_rate: 'effectiveEstateTaxRate',
  cost_of_inaction: 'costOfInaction',
  exemption_utilization: 'exemptionUtilization',
  dsue_at_risk: 'dsueAtRisk',
  liquidity_coverage: 'liquidityCoverage',
  grat_breakeven: 'gratBreakevenRate',
}

const SEVERITY_KEY_TO_METRIC_ID: Record<string, string> = Object.fromEntries(
  Object.entries(METRIC_ID_TO_SEVERITY_KEY).map(([id, key]) => [key, id]),
)

const PRIORITY_ORDER = [
  'liquidityCoverage',
  'dsueAtRisk',
  'costOfInaction',
  'gratBreakevenRate',
  'effectiveEstateTaxRate',
  'exemptionUtilization',
] as const

export function getMetricSeverity(
  key: string,
  value: number | null | undefined,
  context?: { section7520Rate?: number },
): MetricSeverity {
  if (value === null || value === undefined) return 'neutral'

  switch (key) {
    case 'liquidityCoverage':
    case 'liquidityCoverageRatio':
      if (value < 1.0) return 'critical'
      if (value < 1.5) return 'warning'
      return 'ok'

    case 'dsueAtRisk':
      if (value > 0) return 'warning'
      return 'ok'

    case 'costOfInaction':
      if (value > 25_000) return 'warning'
      if (value > 0) return 'neutral'
      return 'ok'

    case 'effectiveEstateTaxRate':
      if (value > 12) return 'warning'
      if (value > 0) return 'neutral'
      return 'ok'

    case 'exemptionUtilization':
      if (value < 20) return 'warning'
      if (value >= 20) return 'neutral'
      return 'neutral'

    case 'gratBreakevenRate': {
      const s7520 = (context?.section7520Rate ?? 0) * 100
      if (s7520 > 0 && Math.abs(value - s7520) < 0.5) return 'warning'
      return 'neutral'
    }

    default:
      return 'neutral'
  }
}

export function getActiveIndicatorKeys(
  metrics: Record<string, number | null | undefined>,
  context?: { section7520Rate?: number },
): Set<string> {
  const criticals = PRIORITY_ORDER.filter(
    (k) => getMetricSeverity(k, metrics[k], context) === 'critical',
  )
  const warnings = PRIORITY_ORDER.filter(
    (k) => getMetricSeverity(k, metrics[k], context) === 'warning',
  )
  return new Set([...criticals, ...warnings].slice(0, 2))
}

function parsePercent(value: string): number | null {
  const m = value.match(/([\d.]+)\s*%/)
  return m ? parseFloat(m[1]) : null
}

function parseRatio(value: string): number | null {
  const m = value.match(/([\d.]+)x/i)
  return m ? parseFloat(m[1]) : null
}

function parseMoneyPerYear(value: string): number | null {
  const m = value.replace(/,/g, '').match(/\$([\d.]+)/)
  return m ? parseFloat(m[1]) : null
}

function parseMoneyMillions(value: string): number | null {
  const plain = value.replace(/[$,]/g, '')
  if (plain.includes('M')) {
    const m = plain.match(/([\d.]+)\s*M/i)
    return m ? parseFloat(m[1]) * 1_000_000 : null
  }
  const n = parseFloat(plain)
  return Number.isFinite(n) ? n : null
}

export function numericValueForMetric(metric: AdvisoryMetric): number | null {
  switch (metric.id) {
    case 'effective_rate':
      return parsePercent(metric.value)
    case 'cost_of_inaction':
      return parseMoneyPerYear(metric.value)
    case 'exemption_utilization':
      return parsePercent(metric.value)
    case 'dsue_at_risk':
      return metric.value === 'None' ? 0 : parseMoneyMillions(metric.value)
    case 'liquidity_coverage':
      return metric.value === 'N/A' ? null : parseRatio(metric.value)
    case 'grat_breakeven':
      return parsePercent(metric.value)
    default:
      return null
  }
}

export function buildSeverityInputFromMetrics(
  metrics: AdvisoryMetric[],
): Record<string, number | null | undefined> {
  const input: Record<string, number | null | undefined> = {}
  for (const metric of metrics) {
    const key = METRIC_ID_TO_SEVERITY_KEY[metric.id]
    if (!key) continue
    input[key] = numericValueForMetric(metric)
  }
  return input
}

export function getActiveIndicatorMetricIds(
  metrics: AdvisoryMetric[],
  context?: { section7520Rate?: number },
): Set<string> {
  const severityInput = buildSeverityInputFromMetrics(metrics)
  const activeKeys = getActiveIndicatorKeys(severityInput, context)
  const ids = new Set<string>()
  for (const key of activeKeys) {
    const id = SEVERITY_KEY_TO_METRIC_ID[key]
    if (id) ids.add(id)
  }
  return ids
}

export function getMetricSeverityForAdvisoryMetric(
  metric: AdvisoryMetric,
  context?: { section7520Rate?: number },
): MetricSeverity {
  const key = METRIC_ID_TO_SEVERITY_KEY[metric.id]
  if (key) {
    const numeric = numericValueForMetric(metric)
    const fromRules = getMetricSeverity(key, numeric, context)
    if (fromRules !== 'neutral' || numeric !== null) return fromRules
  }
  if (metric.status === 'critical') return 'critical'
  if (metric.status === 'warning') return 'warning'
  if (metric.status === 'good') return 'ok'
  return 'neutral'
}

export function parseLiquidityShortfall(metric: AdvisoryMetric | undefined): number | null {
  if (!metric?.subtext) return null
  const m = metric.subtext.match(/Shortfall:\s*\$([\d,]+)/i)
  if (!m) return null
  return parseFloat(m[1].replace(/,/g, ''))
}
