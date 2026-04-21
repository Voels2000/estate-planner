'use client'

// ─────────────────────────────────────────
// Menu: Estate Planning > My Estate Strategy
// Route: /my-estate-strategy
// ─────────────────────────────────────────

import { useState } from 'react'
import Link from 'next/link'
import type { MyEstateStrategyHorizonsResult } from '@/lib/my-estate-strategy/horizonSnapshots'
import ConsumerEstateFlowView from '@/components/estate-flow/ConsumerEstateFlowView'
import { CollapsibleSection } from '@/components/CollapsibleSection'

type Horizons = MyEstateStrategyHorizonsResult

type Props = {
  householdId: string
  scenarioId: string | null
  scenarioMeta: {
    calculatedAt: string | null
  }
  horizons: Horizons
  /** e.g. "April 2026" — matches My Estate Strategy "Today" column */
  estateAsOfLabel: string
  /** Sum of primary residence FMV; only non-null when married + primary home exists */
  primaryResidenceValue: number | null
  /** Whether the household has a spouse (for death-view picker in flow view) */
  hasSpouse: boolean
  survivorEndYear: number
  currentYear: number
  advisorRecommendations: { strategy_type: string; label: string | null }[]
}

export default function MyEstateStrategyClient({
  householdId,
  scenarioId,
  scenarioMeta,
  horizons,
  estateAsOfLabel,
  primaryResidenceValue,
  hasSpouse,
  survivorEndYear,
  currentYear,
  advisorRecommendations,
}: Props) {
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  async function handleGenerateBaseCase() {
    setGenerating(true)
    setGenerateError(null)
    try {
      const res = await fetch('/api/consumer/generate-base-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId }),
      })
      const data = await res.json()
      if (data.success) {
        window.location.reload()
      } else {
        setGenerateError(data.error ?? 'Failed to generate estate plan. Please try again.')
      }
    } catch {
      setGenerateError('Something went wrong. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const hasBaseCase = !!scenarioId
  const { today, tenYear, twentyYear, atDeath, showProjectionMismatchNote } = horizons
  const columns = [today, tenYear, twentyYear, atDeath].filter(
    (col) => !col.isPlaceholder || col.showGenerateCta
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {advisorRecommendations.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 pt-6">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900 mb-2">
              Your advisor has flagged strategies worth discussing
            </p>
            <ul className="space-y-1">
              {advisorRecommendations.map((r) => {
                const LABELS: Record<string, string> = {
                  gifting: 'Annual Gifting Program',
                  revocable_trust: 'Revocable Living Trust',
                  credit_shelter_trust: 'Credit Shelter Trust (CST)',
                  grat: 'Grantor Retained Annuity Trust (GRAT)',
                  crt: 'Charitable Remainder Trust (CRT)',
                  clat: 'Charitable Lead Annuity Trust (CLAT)',
                  daf: 'Donor Advised Fund (DAF)',
                  roth: 'Roth Conversion',
                  liquidity: 'Estate Liquidity Planning',
                }
                const displayLabel = r.label ?? LABELS[r.strategy_type] ?? r.strategy_type
                return (
                  <li key={r.strategy_type} className="flex items-center gap-2 text-sm text-blue-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    {displayLabel}
                  </li>
                )
              })}
            </ul>
            <p className="text-xs text-blue-600 mt-3">
              Contact your advisor to learn more about these strategies.
            </p>
          </div>
        </div>
      )}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">My Estate Strategy</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Estimated estate value and tax exposure across four time horizons, based on your data.
            {scenarioMeta.calculatedAt && (
              <span className="ml-1 text-neutral-400">
                Last updated {new Date(scenarioMeta.calculatedAt).toLocaleDateString()}.
              </span>
            )}
          </p>
        </div>
      </div>

      {survivorEndYear < currentYear + 10 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ℹ️ Your longevity settings end in {survivorEndYear}, which is before the 10-year
          horizon ({currentYear + 10}). The 10-year and 20-year projections are not available.{' '}
          <Link href="/profile" className="underline hover:text-amber-900">
            Update your longevity age in your profile
          </Link>{' '}
          to see these horizons.
        </div>
      )}
      {survivorEndYear >= currentYear + 10 && survivorEndYear < currentYear + 20 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ℹ️ Your longevity settings end in {survivorEndYear}, which is before the 20-year
          horizon ({currentYear + 20}). The 20-year projection is not available.{' '}
          <Link href="/profile" className="underline hover:text-amber-900">
            Update your longevity age in your profile
          </Link>{' '}
          to see this horizon.
        </div>
      )}
      {generateError && (
        <p className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {generateError}
        </p>
      )}

      <CollapsibleSection
        title="Estate value & tax horizons"
        subtitle="Today, 10 years, 20 years, and at second death"
        defaultOpen={true}
        storageKey="my-estate-strategy-horizons"
      >
        <div className={`grid grid-cols-1 gap-4 ${
          columns.length === 4 ? 'lg:grid-cols-4' :
          columns.length === 3 ? 'lg:grid-cols-3' :
          columns.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-1'
        }`}>
          {columns.map((col) => (
            <div
              key={col.headerTitle}
              className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
            >
              <div className={`px-4 py-3 text-center text-sm font-semibold ${col.headerClassName}`}>
                {col.headerTitle}
              </div>
              <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
                <p className="text-xs leading-relaxed text-neutral-600">{col.narrative}</p>

                {col.showGenerateCta ? (
                  <div className="mt-6 flex flex-1 flex-col items-center justify-center text-center">
                    <p className="text-sm text-neutral-700">
                      Generate your estate plan to see projections
                    </p>
                    <button
                      type="button"
                      onClick={handleGenerateBaseCase}
                      disabled={generating}
                      className="mt-4 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      {generating ? 'Generating…' : 'Generate My Estate Plan →'}
                    </button>
                    <Link
                      href="/dashboard"
                      className="mt-3 text-xs text-neutral-400 hover:text-neutral-600 hover:underline"
                    >
                      Or go to Dashboard
                    </Link>
                  </div>
                ) : (
                  <>
                    {col.showMissingRowNote && col.missingRowCalendarYear != null && (
                      <p className="mt-2 text-xs text-amber-800">
                        This projection does not include {col.missingRowCalendarYear}; figures are
                        unavailable for this horizon.
                      </p>
                    )}
                    <div className="mt-4 space-y-3 text-sm">
                      <MetricRow label="Gross estate" value={fmtEst(col.grossEstate)} emphasized />
                      <MetricRow label="Federal exemption" value={fmtEst(col.federalExemption)} />
                      <MetricRow label="Federal exposure" value={fmtEst(col.federalExposure)} />
                      <MetricRow label="Federal tax estimate" value={fmtEst(col.federalTaxEstimate)} />
                      <div className="my-3 border-t border-neutral-200" />
                      <MetricRow label="State exposure" value={fmtEst(col.stateExposure)} />
                      {col === atDeath &&
                        primaryResidenceValue != null &&
                        primaryResidenceValue > 0 && (
                          <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                            ℹ️ This estimate reflects the surviving spouse&apos;s estate at second death
                            and includes the primary residence (est. {fmtEst(primaryResidenceValue)}).
                          </p>
                        )}
                      <MetricRow
                        label="Est. total tax liability"
                        value={fmtEst(col.totalTaxLiability)}
                        emphasized
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {showProjectionMismatchNote && (
        <p className="mt-6 text-xs text-neutral-600">
          Note: projection figures are based on your base case assumptions. Update your profile or
          base case to reflect any changes.
        </p>
      )}

      {hasBaseCase && (
        <CollapsibleSection
          title="What happens when I die?"
          subtitle="How your estate transfers to your heirs — in plain English"
          defaultOpen={false}
          storageKey="my-estate-strategy-heirs-flow"
        >
          <ConsumerEstateFlowView
            householdId={householdId}
            scenarioId={scenarioId}
            estateAsOfLabel={estateAsOfLabel}
            liveNetWorth={today.grossEstate ?? 0}
            hasSpouse={hasSpouse}
            hidePageHeader
          />
        </CollapsibleSection>
      )}
    </div>
  )
}

function MetricRow({
  label,
  value,
  emphasized,
}: {
  label: string
  value: string
  emphasized?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`text-neutral-600 ${emphasized ? 'font-medium text-neutral-800' : ''}`}>
        {label}
      </span>
      <span
        className={`text-right tabular-nums ${emphasized ? 'font-semibold text-neutral-900' : 'text-neutral-900'}`}
      >
        {value}
      </span>
    </div>
  )
}

function fmtEst(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}
