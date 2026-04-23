'use client'

// ─────────────────────────────────────────
// Menu: Estate Planning > My Estate Strategy
// Route: /my-estate-strategy
// ─────────────────────────────────────────

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { MyEstateStrategyHorizonsResult } from '@/lib/my-estate-strategy/horizonSnapshots'
import { CollapsibleSection } from '@/components/CollapsibleSection'

type Horizons = MyEstateStrategyHorizonsResult

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const ConsumerEstateFlowView = dynamic(
  () => import('@/components/estate-flow/ConsumerEstateFlowView'),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
        Loading estate flow...
      </div>
    ),
  },
)

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
  middleContent?: ReactNode
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
  middleContent,
}: Props) {
  const [generating, setGenerating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
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
        setRefreshing(true)
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
  const columns = useMemo(
    () => [today, tenYear, twentyYear, atDeath].filter((col) => !col.isPlaceholder || col.showGenerateCta),
    [today, tenYear, twentyYear, atDeath],
  )
  const gridClassName = useMemo(() => {
    if (columns.length === 4) return 'lg:grid-cols-4'
    if (columns.length === 3) return 'lg:grid-cols-3'
    if (columns.length === 2) return 'lg:grid-cols-2'
    return 'lg:grid-cols-1'
  }, [columns.length])
  const horizonsSubtitle = scenarioMeta.calculatedAt
    ? `Today, 10 years, 20 years, and at second death · Last updated ${new Date(scenarioMeta.calculatedAt).toLocaleDateString()}.`
    : 'Today, 10 years, 20 years, and at second death'
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {refreshing && (
        <p className="mb-4 text-xs font-medium text-blue-700">Refreshing data...</p>
      )}

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
        subtitle={horizonsSubtitle}
        defaultOpen={true}
        storageKey="my-estate-strategy-horizons"
      >
        <div className={`grid grid-cols-1 gap-4 ${gridClassName}`}>
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

                    {/* ── Inside / Outside sub-rows (Session 27 pattern; all horizons) ── */}
                    {col.insideTotal != null && (
                      <div className="mt-3 pt-3 border-t border-neutral-100 space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-neutral-500">Inside taxable estate</span>
                          <span className="font-medium text-blue-700">{fmtEst(col.insideTotal)}</span>
                        </div>
                        {(col.outsideCertainProbableTotal ?? 0) > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-neutral-500">Outside taxable estate</span>
                            <span className="font-medium text-green-700">
                              {fmtEst(col.outsideCertainProbableTotal)}
                            </span>
                          </div>
                        )}
                        {(col.outsideIllustrativeTotal ?? 0) > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-neutral-400 italic">Illustrative strategies</span>
                            <span className="text-neutral-400 italic">
                              {fmtEst(col.outsideIllustrativeTotal)}
                            </span>
                          </div>
                        )}
                        {col.federalExemption != null &&
                          col.insideTotal != null &&
                          col.federalExemption - col.insideTotal > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-neutral-500">Exemption remaining</span>
                              <span className="font-medium text-green-700">
                                {fmtEst(col.federalExemption - col.insideTotal)}
                              </span>
                            </div>
                          )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {middleContent}

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
  return CURRENCY_FORMATTER.format(n)
}
