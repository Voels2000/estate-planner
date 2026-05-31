'use client'

import type { AdvisoryMetric } from '@/lib/advisoryMetrics'
import {
  getMetricSeverity,
  numericValueForMetric,
  parseLiquidityShortfall,
} from '@/lib/advisor/advisoryMetricSeverity'

interface StrategyAlertBannersProps {
  metrics: AdvisoryMetric[]
  exemptionUtilization: number | null
  unusedExemptionAmount: number
  section7520Rate?: number
}

type SecondaryAlert = {
  title: string
  description: string
}

export function StrategyAlertBanners({
  metrics,
  exemptionUtilization,
  unusedExemptionAmount,
  section7520Rate = 0.052,
}: StrategyAlertBannersProps) {
  const liquidityMetric = metrics.find((m) => m.id === 'liquidity_coverage')
  const liquidityRatio = liquidityMetric ? numericValueForMetric(liquidityMetric) : null
  const liquidityShortfall = parseLiquidityShortfall(liquidityMetric)
  const liquidityFormatted =
    liquidityRatio !== null ? `${liquidityRatio.toFixed(1)}x` : liquidityMetric?.value ?? '—'

  const gratMetric = metrics.find((m) => m.id === 'grat_breakeven')
  const gratPct = gratMetric ? numericValueForMetric(gratMetric) : null

  const primaryAlert =
    liquidityRatio !== null && liquidityRatio < 1.0
      ? {
          title: 'Liquidity shortfall — estate settlement at risk',
          description: `Current liquidity coverage is ${liquidityFormatted}${
            liquidityShortfall != null && liquidityShortfall > 0
              ? ` ($${Math.round(liquidityShortfall).toLocaleString()} shortfall)`
              : ''
          }. The estate may not have sufficient liquid assets to cover settlement costs, taxes, and expenses without forced asset sales. Discuss liquidity strategies before the next meeting.`,
        }
      : null

  const secondaryAlerts: SecondaryAlert[] = []

  if (typeof exemptionUtilization === 'number' && exemptionUtilization < 50) {
    secondaryAlerts.push({
      title: `Significant federal exemption unused — ${Math.round(100 - exemptionUtilization)}% ($${(unusedExemptionAmount / 1_000_000).toFixed(1)}M) available`,
      description:
        'Consider systematic gifting programs or irrevocable trust strategies before estate growth reduces available headroom.',
    })
  }

  if (
    gratPct !== null &&
    getMetricSeverity('gratBreakevenRate', gratPct, { section7520Rate }) === 'warning'
  ) {
    secondaryAlerts.push({
      title: `GRAT — tight §7520 margin (${gratPct.toFixed(1)}% breakeven near current ${(section7520Rate * 100).toFixed(1)}% hurdle)`,
      description:
        'Asset growth assumptions should be reviewed before recommending a GRAT. Marginal benefit at current rates.',
    })
  }

  if (!primaryAlert && secondaryAlerts.length === 0) return null

  return (
    <div>
      {primaryAlert && (
        <div className="mb-3 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3">
          <i
            className="ti ti-alert-triangle mt-0.5 flex-shrink-0 text-red-700"
            aria-hidden="true"
            style={{ fontSize: 16 }}
          />
          <div>
            <p className="mb-1 text-sm font-medium text-red-800">{primaryAlert.title}</p>
            <p className="text-xs leading-relaxed text-red-700">{primaryAlert.description}</p>
          </div>
        </div>
      )}

      {secondaryAlerts.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {secondaryAlerts.map((alert) => (
            <div
              key={alert.title}
              className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2"
            >
              <i
                className="ti ti-info-circle mt-0.5 flex-shrink-0 text-amber-700"
                aria-hidden="true"
                style={{ fontSize: 14 }}
              />
              <div>
                <p className="mb-0.5 text-xs font-medium text-amber-800">{alert.title}</p>
                <p className="text-[11px] leading-relaxed text-amber-700">{alert.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
