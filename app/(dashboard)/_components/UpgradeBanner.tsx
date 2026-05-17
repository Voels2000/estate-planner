'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
  householdContext?: {
    grossEstate?: number | null
    statePrimary?: string | null
    firstName?: string | null
  }
}

export default function UpgradeBanner({
  requiredTier,
  moduleName,
  valueProposition,
  householdContext,
}: UpgradeBannerProps) {
  const pathname = usePathname()
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

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 sm:flex-row sm:items-start sm:gap-4">
      <LockIcon className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-amber-950">{moduleName}</p>
        <p className="mt-1 text-sm text-amber-900">{personalizedCopy ?? valueProposition}</p>
        <p className="mt-2 text-xs text-amber-800/90">
          {requiredTier === 2 ? 'Included with the Retirement plan.' : 'Included with the Estate plan.'}
        </p>
      </div>
      <Link
        href={billingHref}
        className="inline-flex shrink-0 items-center justify-center rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-amber-50 sm:self-center"
      >
        Upgrade to unlock
      </Link>
    </div>
  )
}
