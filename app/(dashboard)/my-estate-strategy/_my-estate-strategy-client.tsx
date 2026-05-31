'use client'

/**
 * Consumer estate strategy page client: horizon snapshots, estate flow, links to
 * related planning areas.
 *
 * Route: `/my-estate-strategy`
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type { MyEstateStrategyHorizonsResult } from '@/lib/my-estate-strategy/horizonSnapshots'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import MonteCarloScenarioBanner from '@/components/consumer/MonteCarloScenarioBanner'
import type { ConsumerMCScenario } from '@/lib/monte-carlo/consumerAssumptionScenarios'
import {
  FEDERAL_EXEMPTION_AFTER_GIFTS_LABEL,
  HEADROOM_BEFORE_FEDERAL_TAX_LABEL,
  LIFETIME_GIFTS_USED_LABEL,
} from '@/lib/estate/exemptionLabels'
import { formatDollars } from '@/lib/utils/formatCurrency'
import { DISCLAIMER_STRINGS } from '@/lib/compliance/language-policy'

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
  healthScore?: number | null
  healthScoreComputedAt?: string | null
  scenarioId: string | null
  scenarioMeta: {
    calculatedAt: string | null
  }
  horizons: Horizons
  horizonsProjected?: Horizons
  strategySetSummary?: {
    actualCount: number
    pendingAdvisorCount: number
    projectedCount: number
  }
  /** e.g. "April 2026" — matches My Estate Strategy "Today" column */
  estateAsOfLabel: string
  /** Sum of primary residence FMV; only non-null when married + primary home exists */
  primaryResidenceValue: number | null
  /** Whether the household has a spouse (for death-view picker in flow view) */
  hasSpouse: boolean
  survivorEndYear: number
  currentYear: number
  acceptedMCScenario?: ConsumerMCScenario | null
  latestSharedMCScenario?: ConsumerMCScenario | null
  /** From calculate_gifting_summary.lifetime_exemption_used — same across horizon columns */
  lifetimeGiftsUsed?: number
  statePrimary?: string | null
  bypassTrustSavings?: number
}

export default function MyEstateStrategyClient({
  householdId,
  healthScore = null,
  healthScoreComputedAt = null,
  scenarioId,
  scenarioMeta,
  horizons,
  horizonsProjected,
  strategySetSummary,
  estateAsOfLabel,
  primaryResidenceValue,
  hasSpouse,
  survivorEndYear,
  currentYear,
  acceptedMCScenario,
  latestSharedMCScenario,
  lifetimeGiftsUsed = 0,
  statePrimary = null,
  bypassTrustSavings = 0,
}: Props) {
  const router = useRouter()
  const [generating, setGenerating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [horizonMode, setHorizonMode] = useState<'actual' | 'projected'>('actual')

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
        router.refresh()
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
  const selectedHorizons = horizonMode === 'projected' && horizonsProjected ? horizonsProjected : horizons
  const { today, tenYear, twentyYear, atDeath } = selectedHorizons
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
  void gridClassName
  const horizonsSubtitle = scenarioMeta.calculatedAt
    ? `Today, 10 years, 20 years, and at second death · Last updated ${new Date(scenarioMeta.calculatedAt).toLocaleDateString()}.`
    : 'Today, 10 years, 20 years, and at second death'
  const estimatedTaxTotal = today.totalTaxLiability ?? 0
  const whatIfTotal = strategySetSummary?.projectedCount ?? 0
  const showWhatIfTab = whatIfTotal > 0

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

      {(acceptedMCScenario || latestSharedMCScenario) && (
        <div className="mb-6">
          <MonteCarloScenarioBanner
            acceptedScenario={acceptedMCScenario}
            latestSharedScenario={latestSharedMCScenario}
          />
        </div>
      )}

      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-medium text-[color:var(--mwm-navy)]">Tax Horizons & Strategy</h1>
          <p className="mt-1 text-xs text-[color:var(--mwm-text-secondary)]">
            How your estate tax exposure grows over time — and how strategies change the picture
          </p>
        </div>
        {healthScore != null && (
          <span
            className={[
              'inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
              healthScore >= 80
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : healthScore >= 60
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-red-200 bg-red-50 text-red-800',
            ].join(' ')}
          >
            <i className="ti ti-shield-half" aria-hidden="true" style={{ fontSize: 12 }} />
            Estate readiness {healthScore}/100 ·{' '}
            {healthScore >= 80 ? 'On track' : healthScore >= 60 ? 'In progress' : 'Needs attention'}
          </span>
        )}
      </div>

      <CollapsibleSection
        title="Estate value & tax horizons"
        subtitle={horizonsSubtitle}
        defaultOpen={true}
        storageKey="my-estate-strategy-horizons"
      >
        {showWhatIfTab && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
            <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setHorizonMode('actual')}
                className={`rounded-md px-3 py-1 text-xs font-medium ${
                  horizonMode === 'actual'
                    ? 'bg-blue-600 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                Actual Estate
              </button>
              <button
                type="button"
                onClick={() => setHorizonMode('projected')}
                className={`rounded-md px-3 py-1 text-xs font-medium ${
                  horizonMode === 'projected'
                    ? 'bg-blue-600 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                What-if Advisor Recommendations
              </button>
            </div>
            {strategySetSummary && (
              <div className="text-xs text-neutral-600">
                Active now: <span className="font-semibold">{strategySetSummary.actualCount}</span> · Advisor
                pending: <span className="font-semibold">{strategySetSummary.pendingAdvisorCount}</span> ·
                What-if total: <span className="font-semibold">{strategySetSummary.projectedCount}</span>
              </div>
            )}
          </div>
        )}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {columns.map((col) => (
            <div
              key={col.headerTitle + '-hero'}
              className={`rounded-xl border px-4 py-3 text-center ${
                col === today
                  ? 'border-neutral-300 bg-neutral-50'
                  : col === tenYear
                    ? 'border-blue-200 bg-blue-50'
                    : col === twentyYear
                      ? 'border-[color:var(--mwm-border)] bg-[var(--mwm-gold-pale)]'
                      : 'border-[color:var(--mwm-sage-pale)] bg-[var(--mwm-sage-pale)]'
              }`}
            >
              <p
                className={`mb-1 text-xs font-medium ${
                  col === today
                    ? 'text-neutral-500'
                    : col === tenYear
                      ? 'text-blue-600'
                      : col === twentyYear
                        ? 'text-[color:var(--mwm-navy)]'
                        : 'text-[color:var(--mwm-sage)]'
                }`}
              >
                {col.headerTitle}
              </p>
              <p
                className={`text-lg font-semibold ${
                  col.totalTaxLiability && col.totalTaxLiability > 0
                    ? 'text-red-600'
                    : 'text-neutral-400'
                }`}
              >
                {fmtEst(col.totalTaxLiability)}
              </p>
              <p className="mt-0.5 text-[10px] text-neutral-400">Est. total tax liability</p>
            </div>
          ))}
        </div>

        {bypassTrustSavings > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-[var(--mwm-radius)] border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div>
              <p className="text-xs font-medium text-emerald-800">
                Bypass trust reduces today&apos;s exposure from {fmtEst(estimatedTaxTotal)} to{' '}
                {fmtEst(Math.max(0, estimatedTaxTotal - bypassTrustSavings))}
              </p>
              <p className="mt-0.5 text-[10px] text-emerald-700">
                Attorneys commonly discuss credit shelter trust structures for {statePrimary ?? 'state'}{' '}
                estates — review with your estate attorney
              </p>
            </div>
            <div className="ml-4 flex flex-shrink-0 items-center gap-4">
              <div className="text-center">
                <p className="text-sm font-medium text-emerald-800">{fmtEst(bypassTrustSavings)}</p>
                <p className="text-[10px] text-emerald-700">Today&apos;s saving</p>
              </div>
              <Link
                href="/gifting"
                className="whitespace-nowrap text-xs text-emerald-700 underline underline-offset-2"
              >
                View strategies →
              </Link>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="w-48 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500" />
                {columns.map((col) => (
                  <th
                    key={col.headerTitle + '-th'}
                    className={`px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide ${
                      col === today
                        ? 'text-neutral-600'
                        : col === tenYear
                          ? 'text-blue-600'
                          : col === twentyYear
                            ? 'text-[color:var(--mwm-navy)]'
                            : 'text-[color:var(--mwm-sage)]'
                    }`}
                  >
                    {col.headerTitle}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400"
                >
                  Estate size
                </td>
              </tr>
              <tr className="border-b border-neutral-100 hover:bg-neutral-50/50">
                <td className="px-4 py-2.5 text-sm font-medium text-neutral-600">Gross estate</td>
                {columns.map((col) => (
                  <td
                    key={col.headerTitle + '-gross'}
                    className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-neutral-900"
                  >
                    {fmtEst(col.grossEstate)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-neutral-100 hover:bg-neutral-50/50">
                <td className="px-4 py-2.5 text-sm text-neutral-500">{LIFETIME_GIFTS_USED_LABEL}</td>
                {columns.map((col) => (
                  <td key={col.headerTitle + '-gifts'} className="px-4 py-2.5 text-right text-sm tabular-nums">
                    {lifetimeGiftsUsed > 0 ? (
                      <Link
                        href="/my-estate-trust-strategy?tab=gifting"
                        className="font-medium text-amber-600 hover:underline"
                      >
                        {formatDollars(lifetimeGiftsUsed)}
                      </Link>
                    ) : (
                      <span className="text-neutral-400">{formatDollars(0)}</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-neutral-100 hover:bg-neutral-50/50">
                <td className="px-4 py-2.5 text-sm text-neutral-500">{FEDERAL_EXEMPTION_AFTER_GIFTS_LABEL}</td>
                {columns.map((col) => (
                  <td
                    key={col.headerTitle + '-exemption'}
                    className="px-4 py-2.5 text-right text-sm tabular-nums text-neutral-700"
                  >
                    {fmtEst(col.federalExemption)}
                  </td>
                ))}
              </tr>

              <tr className="border-b border-neutral-100 bg-neutral-50">
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400"
                >
                  Tax exposure
                </td>
              </tr>
              <tr className="border-b border-neutral-100 hover:bg-neutral-50/50">
                <td className="px-4 py-2.5 text-sm text-neutral-500">Federal tax exposure</td>
                {columns.map((col) => (
                  <td
                    key={col.headerTitle + '-fedexp'}
                    className="px-4 py-2.5 text-right text-sm tabular-nums text-neutral-700"
                  >
                    {fmtEst(col.federalExposure)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-neutral-100 hover:bg-neutral-50/50">
                <td className="px-4 py-2.5 text-sm text-neutral-500">Federal tax estimate</td>
                {columns.map((col) => (
                  <td
                    key={col.headerTitle + '-fedtax'}
                    className="px-4 py-2.5 text-right text-sm tabular-nums text-neutral-700"
                  >
                    {fmtEst(col.federalTaxEstimate)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-neutral-100 hover:bg-neutral-50/50">
                <td className="px-4 py-2.5 text-sm text-neutral-500">State tax exposure</td>
                {columns.map((col) => (
                  <td
                    key={col.headerTitle + '-stateexp'}
                    className="px-4 py-2.5 text-right text-sm tabular-nums text-neutral-700"
                  >
                    {fmtEst(col.stateExposure)}
                  </td>
                ))}
              </tr>

              <tr className="border-b-2 border-neutral-200 bg-red-50/40">
                <td className="px-4 py-3 text-sm font-semibold text-neutral-800">
                  Est. total estate tax liability
                </td>
                {columns.map((col) => (
                  <td
                    key={col.headerTitle + '-total'}
                    className="px-4 py-3 text-right text-sm font-bold tabular-nums text-red-600"
                  >
                    {fmtEst(col.totalTaxLiability)}
                  </td>
                ))}
              </tr>

              <tr className="border-b border-neutral-100 bg-neutral-50">
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400"
                >
                  Inside estate
                </td>
              </tr>
              <tr className="border-b border-neutral-100 hover:bg-neutral-50/50">
                <td className="px-4 py-2.5 text-sm text-neutral-500">Inside taxable estate</td>
                {columns.map((col) => (
                  <td
                    key={col.headerTitle + '-inside'}
                    className="px-4 py-2.5 text-right text-sm font-medium tabular-nums text-blue-700"
                  >
                    {fmtEst(col.insideTotal)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-neutral-100 hover:bg-neutral-50/50">
                <td className="px-4 py-2.5 text-sm text-neutral-500">Headroom before federal tax</td>
                {columns.map((col) => (
                  <td key={col.headerTitle + '-headroom'} className="px-4 py-2.5 text-right text-sm font-medium tabular-nums">
                    {col.federalExemption != null &&
                    col.insideTotal != null &&
                    col.federalExemption - col.insideTotal > 0 ? (
                      <span className="text-green-700">
                        {fmtEst(col.federalExemption - col.insideTotal)}
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                ))}
              </tr>

              {primaryResidenceValue != null && primaryResidenceValue > 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-2 text-[11px] italic text-neutral-400">
                    ℹ️ At death estimate reflects surviving spouse&apos;s estate at second death and includes
                    the primary residence (est. {fmtEst(primaryResidenceValue)}).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-neutral-400 mt-3 max-w-2xl">{DISCLAIMER_STRINGS.estateStrategy}</p>

        {columns.some((col) => col.showGenerateCta) && (
          <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-8 text-center">
            <p className="text-sm text-neutral-700">Generate your estate plan to see projections</p>
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
        )}
      </CollapsibleSection>

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
            horizons={selectedHorizons}
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
