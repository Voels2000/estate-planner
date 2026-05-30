import Link from 'next/link'
import { fmt, fmtExact } from '@/app/(dashboard)/_components/dashboard/formatters'
import { EmptyStateCard } from '@/components/dashboard/EmptyStateCard'
import { resolveEstateActionHref } from '@/lib/dashboard/estateUpgradeHref'

export interface EstateCalloutCardProps {
  grossEstate: number
  exemptionRemaining: number
  estimatedTaxFederal: number
  estimatedTaxState: number
  hasStateTax: boolean
  /** True when headroom is under 20% of federal exemption available (gift-aware). */
  exemptionMarginTight?: boolean
  userTier?: number
  statePrimary?: string | null
}

export type EstateTaxSnapshotPanelProps = {
  grossEstate: number
  totalLiabilities: number
  taxableEstate?: number | null
  federalExemption?: number | null
  federalTax: number
  estateTax: number
  statePrimary?: string | null
  /** // TODO: wire state exemption from composition when RPC exposes it */
  stateExemption?: number | null
  consumerTier?: number
}

/** Hero card + four metric tiles (replaces beige "Your Estate Summary" card). */
export function EstateSummaryHeroAndMetrics({
  grossEstate,
  exemptionRemaining,
  estimatedTaxFederal,
  estimatedTaxState,
  statePrimary,
  userTier,
}: Pick<
  EstateCalloutCardProps,
  | 'grossEstate'
  | 'exemptionRemaining'
  | 'estimatedTaxFederal'
  | 'estimatedTaxState'
  | 'statePrimary'
  | 'userTier'
>) {
  if (grossEstate <= 0) {
    return (
      <EmptyStateCard
        message="Add your assets to see your estate picture"
        href="/assets"
        linkLabel="Add assets"
        icon="🏛️"
        showAdvisorNote
      />
    )
  }

  const estateTax = estimatedTaxState
  const federalTax = estimatedTaxFederal
  const isStateExposure = estateTax > 0

  return (
    <div className="space-y-3">
      {(estateTax > 0 || federalTax > 0) && (
        <div
          className={[
            'rounded-[var(--mwm-radius)] border-2 p-5',
            isStateExposure ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50',
          ].join(' ')}
        >
          <p
            className={`mb-2 text-[10px] font-medium uppercase tracking-wider ${
              isStateExposure ? 'text-red-700' : 'text-amber-700'
            }`}
          >
            ⚠ Estimated estate tax exposure
          </p>

          <div className="mb-1 flex items-baseline gap-3">
            <p
              className={`text-3xl font-medium leading-none ${
                isStateExposure ? 'text-red-800' : 'text-amber-800'
              }`}
            >
              {fmt(estateTax > 0 ? estateTax : federalTax)}
            </p>
            {isStateExposure && statePrimary && (
              <p className="text-sm text-red-700">{statePrimary} state tax</p>
            )}
          </div>

          <p className={`mb-4 text-xs ${isStateExposure ? 'text-red-700' : 'text-amber-700'}`}>
            Based on your current estate of {fmtExact(grossEstate)}
            {federalTax === 0 ? ' · $0 federal (below exemption)' : ''}
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href={resolveEstateActionHref('/my-estate-strategy', userTier)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium text-white ${
                isStateExposure ? 'bg-red-800' : 'bg-amber-800'
              }`}
            >
              View strategies →
            </Link>
            <Link
              href="/estate-tax"
              className={`rounded-full border px-4 py-1.5 text-xs ${
                isStateExposure
                  ? 'border-red-300 text-red-800'
                  : 'border-amber-300 text-amber-800'
              }`}
            >
              View tax snapshot
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Gross estate',
            value: fmt(grossEstate),
            sub: 'Total assets',
            color: '',
          },
          {
            label: 'Federal headroom',
            value: fmt(exemptionRemaining),
            sub: 'Before fed tax',
            color: 'text-emerald-700',
          },
          {
            label: 'Est. federal tax',
            value: fmt(federalTax),
            sub: federalTax === 0 ? 'Below exemption' : 'Due at death',
            color: federalTax > 0 ? 'text-red-700' : '',
          },
          {
            label: 'Est. state tax',
            value: fmt(estateTax),
            sub: statePrimary ? `${statePrimary} estate tax` : 'State tax',
            color: estateTax > 0 ? 'text-red-700' : '',
          },
        ].map((tile) => (
          <div
            key={tile.label}
            className="rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white p-3"
          >
            <p className="mb-1 text-[10px] uppercase tracking-wide text-[color:var(--mwm-text-secondary)]">
              {tile.label}
            </p>
            <p className={`text-lg font-medium ${tile.color || 'text-[color:var(--mwm-navy)]'}`}>
              {tile.value}
            </p>
            <p className="mt-0.5 text-[10px] text-[color:var(--mwm-text-secondary)]">{tile.sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Right column tax snapshot for two-column dashboard layout. */
export function EstateTaxSnapshotPanel({
  grossEstate,
  totalLiabilities,
  taxableEstate,
  federalExemption,
  federalTax,
  estateTax,
  statePrimary,
  stateExemption,
  consumerTier,
}: EstateTaxSnapshotPanelProps) {
  const taxable = taxableEstate ?? grossEstate
  const strategyHref = resolveEstateActionHref('/my-estate-strategy', consumerTier)

  const rows = [
    { label: 'Gross estate', value: fmtExact(grossEstate), color: '' },
    { label: 'Debts & liabilities', value: fmtExact(totalLiabilities), color: '' },
    { label: 'Taxable estate', value: fmtExact(taxable), color: '' },
    {
      label: 'Federal exemption',
      value: fmtExact(federalExemption ?? 13_610_000),
      color: '',
    },
    {
      label: 'Federal tax',
      value: fmtExact(federalTax),
      color: federalTax > 0 ? 'text-red-700' : 'text-emerald-700',
    },
    statePrimary
      ? {
          label: `${statePrimary} exemption`,
          value: fmtExact(stateExemption ?? 0),
          color: '',
        }
      : null,
    statePrimary
      ? {
          label: `${statePrimary} estate tax`,
          value: fmtExact(estateTax),
          color: estateTax > 0 ? 'text-red-700' : 'text-emerald-700',
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string; color: string }>

  return (
    <div className="rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--mwm-text-secondary)]">
          Tax snapshot
        </p>
        <Link href="/estate-tax" className="text-xs text-emerald-700">
          Full view →
        </Link>
      </div>

      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between border-b border-[color:var(--mwm-border)] py-1.5 text-xs last:border-b-0"
        >
          <span className="text-[color:var(--mwm-text-secondary)]">{row.label}</span>
          <span className={`font-medium ${row.color || 'text-[color:var(--mwm-navy)]'}`}>
            {row.value}
          </span>
        </div>
      ))}

      <Link href={strategyHref} className="mt-3 block text-right text-xs text-emerald-700">
        View gifting & trust strategies →
      </Link>
    </div>
  )
}

/** @deprecated Use EstateSummaryHeroAndMetrics — kept for import compatibility. */
export function EstateCalloutCard(props: EstateCalloutCardProps) {
  return <EstateSummaryHeroAndMetrics {...props} />
}