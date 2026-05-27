'use client'

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

interface StrategyImpactPanelProps {
  currentGrossEstate: number
  currentFederalTax: number
  currentStateTax: number
  currentOutsideEstate: number
  projectedFederalTax: number
  projectedStateTax: number
  projectedOutsideEstate: number
  pendingCount: number
  acceptedCount: number
}

export function StrategyImpactPanel({
  currentGrossEstate,
  currentFederalTax,
  currentStateTax,
  currentOutsideEstate,
  projectedFederalTax,
  projectedStateTax,
  projectedOutsideEstate,
  pendingCount,
  acceptedCount,
}: StrategyImpactPanelProps) {
  if (!currentGrossEstate) return null

  const currentTotalTax = currentFederalTax + currentStateTax
  const projectedTotalTax = projectedFederalTax + projectedStateTax
  const projectedSavings = currentTotalTax - projectedTotalTax

  const hasPending = pendingCount > 0
  const hasAccepted = acceptedCount > 0

  if (!hasPending && !hasAccepted) return null

  const colCountClass = hasPending && hasAccepted ? 'grid-cols-3' : 'grid-cols-2'

  return (
    <div className="mb-5 overflow-hidden rounded-xl border border-[#0F1B3C]/10 bg-[#0F1B3C]/[0.02]">
      <div className="border-b border-[#0F1B3C]/10 bg-[#0F1B3C]/[0.03] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#0F1B3C]">Strategy Impact</p>
        <p className="mt-0.5 text-xs text-gray-400">Effect of recommendations on estimated tax liability</p>
      </div>

      <div className={`grid divide-x divide-[#0F1B3C]/10 ${colCountClass}`}>
        <ImpactColumn
          label="Current"
          sublabel="No strategies applied"
          grossEstate={currentGrossEstate}
          outsideEstate={currentOutsideEstate}
          federalTax={currentFederalTax}
          stateTax={currentStateTax}
          totalTax={currentTotalTax}
          variant="base"
        />

        {hasPending && (
          <ImpactColumn
            label="Projected"
            sublabel={`${pendingCount} pending recommendation${pendingCount > 1 ? 's' : ''}`}
            grossEstate={currentGrossEstate}
            outsideEstate={projectedOutsideEstate}
            federalTax={projectedFederalTax}
            stateTax={projectedStateTax}
            totalTax={projectedTotalTax}
            deltaVsBase={projectedSavings}
            variant="projected"
          />
        )}

        {hasAccepted && (
          <ImpactColumn
            label="With Accepted"
            sublabel={`${acceptedCount} strateg${acceptedCount > 1 ? 'ies' : 'y'} active`}
            grossEstate={currentGrossEstate}
            outsideEstate={currentOutsideEstate}
            federalTax={currentFederalTax}
            stateTax={currentStateTax}
            totalTax={currentTotalTax}
            variant="actual"
          />
        )}
      </div>

      {hasPending && projectedSavings > 0 && (
        <div className="flex items-center justify-between border-t border-[#0F1B3C]/10 bg-green-50/50 px-4 py-3">
          <p className="text-xs text-green-700">If client accepts all pending recommendations:</p>
          <p className="text-sm font-bold text-green-700">{MONEY.format(projectedSavings)} in projected tax savings</p>
        </div>
      )}
    </div>
  )
}

interface ImpactColumnProps {
  label: string
  sublabel: string
  grossEstate: number
  outsideEstate: number
  federalTax: number
  stateTax: number
  totalTax: number
  deltaVsBase?: number
  variant: 'base' | 'projected' | 'actual'
}

function ImpactColumn({
  label,
  sublabel,
  grossEstate,
  outsideEstate,
  federalTax,
  stateTax,
  totalTax,
  deltaVsBase,
  variant,
}: ImpactColumnProps) {
  const insideEstate = Math.max(0, grossEstate - outsideEstate)
  const accentColor = {
    base: 'text-gray-500',
    projected: 'text-blue-600',
    actual: 'text-green-700',
  }[variant]

  return (
    <div className="space-y-3 px-4 py-4">
      <div>
        <p className={`text-xs font-semibold ${accentColor}`}>{label}</p>
        <p className="mt-0.5 text-[11px] text-gray-400">{sublabel}</p>
      </div>

      <div className="space-y-2">
        <MetricRow label="Inside taxable estate" value={MONEY.format(insideEstate)} dimmed={variant === 'base'} />
        {outsideEstate > 0 && (
          <MetricRow label="Outside taxable estate" value={MONEY.format(outsideEstate)} positive />
        )}
        <div className="mt-2 border-t border-[#0F1B3C]/10 pt-2">
          <MetricRow label="Federal tax" value={MONEY.format(federalTax)} tax />
          <MetricRow label="State tax" value={MONEY.format(stateTax)} tax />
        </div>
        <div className="border-t border-[#0F1B3C]/10 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">Total est. tax</p>
            <p className={`text-sm font-bold ${totalTax > 0 ? 'text-red-600' : 'text-gray-400'}`}>{MONEY.format(totalTax)}</p>
          </div>
          {deltaVsBase !== undefined && deltaVsBase > 0 && (
            <p className="mt-0.5 text-right text-[11px] font-medium text-green-600">↓ {MONEY.format(deltaVsBase)} vs current</p>
          )}
          {deltaVsBase !== undefined && deltaVsBase < 0 && (
            <p className="mt-0.5 text-right text-[11px] text-red-500">↑ {MONEY.format(Math.abs(deltaVsBase))} vs current</p>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricRow({
  label,
  value,
  dimmed,
  positive,
  tax,
}: {
  label: string
  value: string
  dimmed?: boolean
  positive?: boolean
  tax?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <p className={`text-[11px] ${dimmed ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
      <p className={`text-xs font-medium ${positive ? 'text-green-600' : tax ? 'text-red-500' : 'text-gray-700'}`}>{value}</p>
    </div>
  )
}
