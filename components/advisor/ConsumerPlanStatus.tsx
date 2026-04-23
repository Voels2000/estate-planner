// components/advisor/ConsumerPlanStatus.tsx
// Session 31 / Sprint 89 — NEW FILE
//
// Read-only panel shown inside the advisor StrategyTab.
// Displays the consumer's confirmed strategy_line_items (source_role='consumer')
// alongside whether the client has acted on each advisor recommendation.
// Advisors cannot edit these rows — the consumer owns them.

'use client'

import type { EstateComposition, StrategyLineItem } from '@/lib/estate/types'

const STRATEGY_LABELS: Record<string, string> = {
  grat:      'GRAT',
  crt:       'Charitable Remainder Trust',
  clat:      'Charitable Lead Annuity Trust',
  daf:       'Donor-Advised Fund',
  liquidity: 'Liquidity Strategy (ILIT)',
  roth:      'Roth Conversion',
}

const CONFIDENCE_DISPLAY: Record<string, { label: string; classes: string }> = {
  certain:     { label: 'Complete',     classes: 'bg-green-50 text-green-700 border-green-200' },
  probable:    { label: 'In progress',  classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  illustrative:{ label: 'Modeled only', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n)

interface Props {
  consumerComposition: EstateComposition | null
  consumerLineItems: Pick<StrategyLineItem, 'amount' | 'confidence_level' | 'effective_year' | 'is_active' | 'sign' | 'strategy_source' | 'source_role'>[]
  strategyConfigs: any[]
}

export default function ConsumerPlanStatus({
  consumerComposition,
  consumerLineItems,
  strategyConfigs,
}: Props) {
  const recommendedSources = new Set(
    strategyConfigs.map((c: any) => c.strategy_source)
  )
  const consumerSources = new Set(
    consumerLineItems.map((i) => i.strategy_source)
  )
  const pendingSources = [...recommendedSources].filter(
    (s) => !consumerSources.has(s)
  )

  if (consumerLineItems.length === 0 && recommendedSources.size === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No strategies confirmed by client yet.
      </div>
    )
  }

  if (consumerLineItems.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        <p>Client has not confirmed any strategies yet.</p>
        {recommendedSources.size > 0 && (
          <p className="mt-1">
            You have recommended{' '}
            {[...recommendedSources]
              .map((s) => STRATEGY_LABELS[s] ?? s)
              .join(', ')}
            . The client will see{' '}
            {recommendedSources.size === 1 ? 'this' : 'these'} as a suggestion
            in their portal.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {consumerLineItems.map((item) => {
        const label = STRATEGY_LABELS[item.strategy_source] ?? item.strategy_source
        const conf  = CONFIDENCE_DISPLAY[item.confidence_level ?? 'probable']
        const isRecommendedByAdvisor = recommendedSources.has(item.strategy_source)

        return (
          <div
            key={item.strategy_source}
            className="flex items-center justify-between rounded-lg border px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{label}</span>
              {isRecommendedByAdvisor && (
                <span className="text-xs px-1.5 py-0.5 rounded border bg-blue-50 text-blue-600 border-blue-200">
                  Your recommendation
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {fmt(item.amount)}
              </span>
              {conf && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border ${conf.classes}`}
                >
                  {conf.label}
                </span>
              )}
            </div>
          </div>
        )
      })}

      {/* Strategies advisor recommended but client hasn't started */}
      {pendingSources.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-medium">Not yet started by client: </span>
          {pendingSources.map((s) => STRATEGY_LABELS[s] ?? s).join(', ')}
        </div>
      )}

      {/* Consumer estate summary if available */}
      {consumerComposition && (
        <div className="mt-4 rounded-lg border p-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Gross estate</p>
            <p className="font-medium">{fmt(consumerComposition.gross_estate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Taxable estate</p>
            <p className="font-medium">{fmt(consumerComposition.taxable_estate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Est. tax</p>
            <p className={`font-medium ${consumerComposition.estimated_tax > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {fmt(consumerComposition.estimated_tax)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
