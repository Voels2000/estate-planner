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
}

export function EstateCalloutCard({
  grossEstate,
  exemptionRemaining,
  estimatedTaxFederal,
  estimatedTaxState,
  hasStateTax,
  exemptionMarginTight = false,
}: EstateCalloutCardProps) {
  if (grossEstate <= 0) {
    return (
      <EmptyStateCard
        message="Add your assets to see your estate picture"
        href="/assets"
        linkLabel="Add assets"
        icon="🏛️"
      />
    )
  }

  const federalTaxClass =
    estimatedTaxFederal > 0 ? 'text-amber-700 font-medium' : 'text-neutral-400'

  const exemptionClass = exemptionMarginTight
    ? 'text-amber-700 font-medium'
    : 'text-[color:var(--mwm-sage)] font-medium'

  return (
    <section className="rounded-xl border border-[color:var(--mwm-border)] bg-[var(--mwm-gold-pale)]/60 p-5 shadow-sm">
      <h2 className="text-base font-semibold text-neutral-900">Your Estate Summary</h2>

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

      <Link
        href="/estate-tax"
        className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
      >
        View Estate Tax Snapshot →
      </Link>
    </section>
  )
}
