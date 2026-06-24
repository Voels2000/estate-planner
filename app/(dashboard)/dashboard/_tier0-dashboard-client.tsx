'use client'

import Link from 'next/link'
import { fmtExact } from '@/app/(dashboard)/_components/dashboard/formatters'
import { NetWorthBar } from '@/app/(dashboard)/_components/dashboard/ui-primitives'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import type { NetWorthSummary } from '@/lib/view-models/netWorthSummary'

const DATA_ENTRY_LINKS = [
  { href: '/assets', label: 'Assets' },
  { href: '/liabilities', label: 'Liabilities' },
  { href: '/income', label: 'Income' },
  { href: '/expenses', label: 'Expenses' },
  { href: '/real-estate', label: 'Real Estate' },
  { href: '/businesses', label: 'Businesses' },
  { href: '/insurance', label: 'Insurance' },
  { href: '/property-casualty', label: 'Property & Casualty' },
] as const

const UPGRADE_MODULES = [
  { href: '/projections', label: 'Forward Projections', tier: 'Financial' },
  { href: '/scenarios', label: 'What-If Scenarios', tier: 'Financial' },
  { href: '/import', label: 'Import Data', tier: 'Financial' },
  { href: '/social-security', label: 'Social Security', tier: 'Retirement' },
  { href: '/monte-carlo', label: 'Monte Carlo', tier: 'Retirement' },
  { href: '/estate-tax', label: 'Estate Tax', tier: 'Estate' },
] as const

type Props = {
  userName: string
  netWorth: NetWorthSummary
  mortgageBalance: number
  otherLiabilities: number
}

export function Tier0DashboardClient({
  userName,
  netWorth,
  mortgageBalance,
  otherLiabilities,
}: Props) {
  const firstName = userName.split(/\s+/)[0] || 'there'
  const sourceTotal =
    netWorth.financialAssets + netWorth.realEstateValue + netWorth.businessValue

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <DisclaimerBanner />
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-[color:var(--mwm-navy)]">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-sm text-[color:var(--mwm-text-secondary)]">
          Your financial picture is saved. Upgrade to unlock projections, retirement modeling, and
          estate analysis.
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">
          Net Worth
        </p>
        <p
          className={`text-4xl font-bold mb-4 ${netWorth.netWorth >= 0 ? 'text-neutral-900' : 'text-red-600'}`}
        >
          {fmtExact(netWorth.netWorth)}
        </p>
        {sourceTotal > 0 && (
          <div className="space-y-2">
            <NetWorthBar
              label="Financial Assets"
              value={netWorth.financialAssets}
              total={sourceTotal}
              color="bg-blue-500"
            />
            <NetWorthBar
              label="Real Estate (FMV)"
              value={netWorth.realEstateValue}
              total={sourceTotal}
              color="bg-[var(--mwm-sage)]"
            />
            <NetWorthBar
              label="Business Interests"
              value={netWorth.businessValue}
              total={sourceTotal}
              color="bg-[var(--mwm-sage-pale)]"
            />
            {netWorth.totalLiabilities > 0 && (
              <>
                <div className="flex items-center gap-3 pt-2 border-t border-neutral-100">
                  <span className="w-36 text-xs text-neutral-400 shrink-0">Mortgage Balance</span>
                  <div className="flex-1" />
                  <span className="text-xs font-semibold text-red-500">
                    − {fmtExact(mortgageBalance)}
                  </span>
                </div>
                {otherLiabilities > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="w-36 text-xs text-neutral-400 shrink-0">Other Liabilities</span>
                    <div className="flex-1" />
                    <span className="text-xs font-semibold text-red-500">
                      − {fmtExact(otherLiabilities)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-[color:var(--mwm-navy)] mb-3">
          Your data — always free to enter
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DATA_ENTRY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-[color:var(--mwm-navy)] hover:border-[color:var(--mwm-navy)]/30 transition"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <p className="mt-3 text-xs text-[color:var(--mwm-text-muted)]">
          Input export (portable data download) ships in a follow-on release — your entries are
          stored and editable at no cost.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[color:var(--mwm-navy)] mb-3">
          Unlock modeling & analysis
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {UPGRADE_MODULES.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm hover:bg-amber-50 transition"
            >
              <span className="font-medium text-amber-950">{mod.label}</span>
              <span className="text-xs text-amber-800">{mod.tier} plan</span>
            </Link>
          ))}
        </div>
        <p className="mt-3">
          <Link href="/billing" className="text-sm font-medium text-[color:var(--mwm-navy)] underline">
            View plans →
          </Link>
        </p>
      </section>
    </div>
  )
}
