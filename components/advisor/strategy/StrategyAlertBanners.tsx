'use client'

import type { AdvisoryMetric } from '@/lib/advisoryMetrics'
import {
  getMetricSeverity,
  numericValueForMetric,
  parseLiquidityShortfall,
} from '@/lib/advisor/advisoryMetricSeverity'

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

interface StrategyAlertBannersProps {
  metrics: AdvisoryMetric[]
  exemptionUtilization: number | null
  unusedExemptionAmount: number
  section7520Rate?: number
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
  const showGratMargin =
    gratPct !== null &&
    getMetricSeverity('gratBreakevenRate', gratPct, { section7520Rate }) === 'warning'

  return (
    <div className="space-y-4">
      {liquidityRatio !== null && liquidityRatio < 1.0 && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-5 py-4">
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"
            />
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-800">
              Liquidity Shortfall — Estate Settlement at Risk
            </p>
            <p className="mt-0.5 text-sm text-red-700">
              Current liquidity coverage is {liquidityFormatted}
              {liquidityShortfall != null && liquidityShortfall > 0
                ? ` (${MONEY.format(liquidityShortfall)} shortfall)`
                : ''}
              . The estate may not have sufficient liquid assets to cover settlement costs, taxes,
              and expenses without forced asset sales. Recommend discussing liquidity strategies
              before the next meeting.
            </p>
          </div>
        </div>
      )}

      {typeof exemptionUtilization === 'number' && exemptionUtilization < 50 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4">
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"
            />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">Significant Federal Exemption Unused</p>
            <p className="mt-0.5 text-sm text-amber-700">
              {(100 - exemptionUtilization).toFixed(0)}% of the federal exemption is unused (
              {MONEY.format(unusedExemptionAmount)}). Consider systematic gifting programs or
              irrevocable trust strategies before estate growth reduces available headroom.
            </p>
          </div>
        </div>
      )}

      {showGratMargin && gratPct !== null && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-amber-800">GRAT — Tight §7520 Margin</p>
            <p className="mt-0.5 text-sm text-amber-700">
              The GRAT breakeven rate ({gratPct.toFixed(1)}%) is near the current §7520 hurdle (
              {(section7520Rate * 100).toFixed(1)}%). Asset growth assumptions should be reviewed
              before recommending a GRAT.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
