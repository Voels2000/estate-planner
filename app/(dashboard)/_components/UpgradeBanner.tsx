'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAnnualBillingAvailable } from '@/lib/billing/AnnualBillingContext'
import { upgradePricingLine } from '@/lib/billing/upgradePricingCopy'
import { formatDollars } from '@/lib/utils/formatCurrency'

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

interface UpgradeBannerProps {
  requiredTier: 2 | 3
  moduleName: string
  valueProposition: string
  ctaLabel?: string
  householdContext?: {
    grossEstate?: number | null
    statePrimary?: string | null
    firstName?: string | null
    estimatedTaxState?: number | null
    estimatedTaxFederal?: number | null
    topConflict?: string | null
  }
}

export default function UpgradeBanner({
  requiredTier,
  moduleName,
  valueProposition,
  ctaLabel = 'Upgrade to unlock →',
  householdContext,
}: UpgradeBannerProps) {
  const pathname = usePathname()
  const annualBillingAvailable = useAnnualBillingAvailable()
  const billingHref = `/billing?returnTo=${encodeURIComponent(pathname)}`

  function buildPersonalizedCopy(): string | null {
    if (!householdContext) return null
    const { grossEstate, statePrimary, firstName } = householdContext
    if (!grossEstate || grossEstate < 100000) return null

    const fmt = (n: number) =>
      n >= 1_000_000
        ? `$${(n / 1_000_000).toFixed(1)}M`
        : `$${Math.round(n / 1000)}K`

    const STATE_ESTATE_TAX_STATES = [
      'WA',
      'OR',
      'MN',
      'IL',
      'MD',
      'MA',
      'CT',
      'NY',
      'HI',
      'ME',
      'VT',
      'DC',
      'RI',
    ]
    const hasStateTax = statePrimary
      ? STATE_ESTATE_TAX_STATES.includes(statePrimary.toUpperCase())
      : false

    const name = firstName ? `${firstName}'s` : 'Your'

    if (requiredTier === 3) {
      if (hasStateTax && statePrimary) {
        return `${name} estate is approximately ${fmt(grossEstate)}. ${statePrimary.toUpperCase()} has a state estate tax — your estate may owe tax today. Upgrade to see the full breakdown and what you can do about it.`
      }
      return `${name} estate is approximately ${fmt(grossEstate)}. Upgrade to see your exact estate tax exposure, federal exemption remaining, and strategies to reduce your liability.`
    }

    if (requiredTier === 2) {
      return `With ${fmt(grossEstate)} in assets, retirement planning decisions — Social Security timing, Roth conversions, RMDs — could significantly affect your estate. Upgrade to model these scenarios.`
    }

    return null
  }

  const personalizedCopy = buildPersonalizedCopy()

  const totalTax =
    (householdContext?.estimatedTaxState ?? 0) + (householdContext?.estimatedTaxFederal ?? 0)
  const hasTaxExposure = totalTax > 0

  const tierContext =
    requiredTier === 2 ? (
      <div className="mb-4 text-sm leading-relaxed text-[color:var(--mwm-text-secondary)]">
        <p className="mb-1 font-medium text-[color:var(--mwm-navy)]">
          Retirement planning at your asset level
        </p>
        <p>
          Retirement planning for $2M–$30M households isn&apos;t just about saving enough — it&apos;s
          about sequencing withdrawals, timing Social Security, and managing tax exposure across
          decades. These tools model your specific situation, not rules of thumb.
        </p>
        <p className="mt-2 text-[color:var(--mwm-text-muted)]">
          A financial advisor or CPA can validate your assumptions and help you act on what you&apos;re
          seeing here.
        </p>
      </div>
    ) : (
      <div className="mb-4 text-sm leading-relaxed text-[color:var(--mwm-text-secondary)]">
        <p className="mb-1 font-medium text-[color:var(--mwm-navy)]">
          Estate planning is where the largest transfers happen
        </p>
        <p>
          At $2M–$30M in assets, estate planning isn&apos;t optional — it&apos;s where the most costly
          mistakes occur and where proactive planning has the greatest impact. These tools show you
          your tax exposure, beneficiary gaps, and available strategies.
        </p>
        <p className="mt-2 text-[color:var(--mwm-text-muted)]">
          Estate planning at this level requires an attorney. My Wealth Maps prepares you for that
          conversation — showing you exactly what needs to be addressed, in language your attorney
          will recognize.{' '}
          <Link
            href="/find-attorney"
            className="text-[color:var(--mwm-navy)] underline underline-offset-2"
          >
            Find an estate attorney →
          </Link>
        </p>
      </div>
    )

  return (
    <div className="mb-6 flex flex-col gap-3">
      {hasTaxExposure && householdContext?.grossEstate != null && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-red-500">
            Your estimated estate tax exposure
          </p>
          <p className="mb-1 text-3xl font-bold text-red-700">{formatDollars(totalTax)}</p>
          <p className="text-sm text-gray-600">
            Based on your {formatDollars(householdContext.grossEstate)} estate
            {householdContext.statePrimary ? ` in ${householdContext.statePrimary}` : ''}. Upgrade
            to see your full breakdown, 10-year horizon, and strategies to reduce this exposure.
          </p>
        </div>
      )}

      {householdContext?.topConflict && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <span className="mt-0.5">⚠</span>
          <p>
            <span className="font-medium">Planning gap identified: </span>
            {householdContext.topConflict} — and potentially more. Upgrade to see all gaps and how
            to address them.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 sm:flex-row sm:items-start sm:gap-4">
      <LockIcon className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
      <div className="min-w-0 flex-1">
        {tierContext}
        <p className="font-semibold text-amber-950">{moduleName}</p>
        <p className="mt-1 text-sm text-amber-900">{personalizedCopy ?? valueProposition}</p>
        <p className="mt-2 text-sm text-amber-900/90">
          {upgradePricingLine(requiredTier, annualBillingAvailable)}
        </p>
        <p className="mt-1 text-xs text-amber-800/90">
          {requiredTier === 2 ? 'Included with the Retirement plan.' : 'Included with the Estate plan.'}
        </p>
      </div>
      <Link
        href={billingHref}
        className="inline-flex shrink-0 items-center justify-center rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-amber-50 sm:self-center"
      >
        {ctaLabel}
      </Link>
      </div>
    </div>
  )
}
