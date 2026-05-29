import Link from 'next/link'
import { formatDollars } from '@/lib/utils/formatCurrency'
import { HEADROOM_BEFORE_FEDERAL_TAX_LABEL } from '@/lib/estate/exemptionLabels'
import { EmptyStateCard } from '@/components/dashboard/EmptyStateCard'

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

export function EstateCalloutCard({
  grossEstate,
  exemptionRemaining,
  estimatedTaxFederal,
  estimatedTaxState,
  hasStateTax,
  exemptionMarginTight = false,
  userTier,
  statePrimary,
}: EstateCalloutCardProps) {
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

  const totalTaxExposure = estimatedTaxFederal + estimatedTaxState
  const showTaxHeadline = totalTaxExposure > 0

  const federalTaxClass =
    estimatedTaxFederal > 0 ? 'text-amber-700 font-medium' : 'text-neutral-400'

  const exemptionClass = exemptionMarginTight
    ? 'text-amber-700 font-medium'
    : 'text-[color:var(--mwm-sage)] font-medium'

  const taxJurisdictionLabel = (() => {
    const parts: string[] = []
    if (hasStateTax && estimatedTaxState > 0 && statePrimary) {
      parts.push(`${statePrimary} state`)
    }
    if (estimatedTaxFederal > 0) {
      parts.push('federal')
    }
    return parts.length > 0 ? `(${parts.join(' + ')})` : null
  })()

  return (
    <section className="rounded-xl border border-[color:var(--mwm-border)] bg-[var(--mwm-gold-pale)]/60 p-5 shadow-sm">
      <h2 className="text-base font-semibold text-neutral-900">Your Estate Summary</h2>

      {showTaxHeadline && (
        <div className="mb-4 mt-4 rounded-lg border border-red-200 bg-red-50/60 px-4 py-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-red-500">
            Estimated Estate Tax Exposure
          </p>
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-2xl font-bold text-red-700">{formatDollars(totalTaxExposure)}</p>
            {taxJurisdictionLabel && (
              <p className="text-xs text-red-500">{taxJurisdictionLabel}</p>
            )}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Based on your current estate of {formatDollars(grossEstate)}
          </p>
        </div>
      )}

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Gross Estate
          </dt>
          <dd className="mt-0.5 text-lg font-semibold text-neutral-900">
            {formatDollars(grossEstate)}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {HEADROOM_BEFORE_FEDERAL_TAX_LABEL}
          </dt>
          <dd className={`mt-0.5 text-lg font-semibold ${exemptionClass}`}>
            {formatDollars(exemptionRemaining)}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Est. Federal Tax
          </dt>
          <dd className={`mt-0.5 text-lg font-semibold ${federalTaxClass}`}>
            {formatDollars(estimatedTaxFederal)}
          </dd>
        </div>

        {hasStateTax && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Est. State Tax
            </dt>
            <dd className="mt-0.5 text-lg font-semibold text-amber-700">
              {formatDollars(estimatedTaxState)}
            </dd>
          </div>
        )}
      </dl>

      {userTier && userTier < 3 ? (
        <Link
          href="/estate-tax"
          className="mt-4 flex items-center justify-between rounded-lg bg-[color:var(--mwm-navy)] px-4 py-3 text-white transition-colors hover:bg-[color:var(--mwm-navy)]/90"
        >
          <div>
            <p className="text-sm font-semibold">See your full estate breakdown</p>
            <p className="mt-0.5 text-xs text-white/70">
              10-year horizon, strategy modeling, and planning gaps
            </p>
          </div>
          <span className="ml-4 text-white/80">→</span>
        </Link>
      ) : (
        <Link
          href="/estate-tax"
          className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          View Estate Tax Snapshot →
        </Link>
      )}
    </section>
  )
}
