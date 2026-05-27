'use client'

// components/estate/EstateCompositionCard.tsx
// Inside / Outside Taxable Estate classification card.
// Fetches from /api/estate-composition on mount (client-side usage)
// OR accepts a pre-fetched composition prop (server-side usage).
//
// Displays:
//   • Inside Taxable Estate — financial / RE / business / insurance breakdown
//   • Liquid vs Illiquid sub-breakdown
//   • Outside — completed structural transfers (estate_inclusion_status != 'included')
//   • Outside — advisor-recommended strategies (strategy_line_items)
//   • Federal exemption (after gifts) + headroom before federal tax
//   • Three-tier metric row: Gross / Net / Taxable
//
// Confidence badges on strategy items: certain (green) / probable (blue) / illustrative (gray)

import { useEffect, useState } from 'react'
import type { EstateComposition, OutsideStructureItem, OutsideStrategyItem } from '@/lib/estate/types'
import {
  FEDERAL_EXEMPTION_AFTER_GIFTS_LABEL,
  HEADROOM_BEFORE_FEDERAL_TAX_LABEL,
} from '@/lib/estate/exemptionLabels'

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : `$${Math.round(n).toLocaleString()}`

const fmtK = (n: number | null | undefined) => {
  if (n == null) return '—'
  return `$${Math.round(n).toLocaleString()}`
}

const CONFIDENCE_BADGE: Record<string, string> = {
  certain:      'bg-green-100 text-green-800 border-green-200',
  probable:     'bg-blue-100 text-blue-800 border-blue-200',
  illustrative: 'bg-gray-100 text-gray-600 border-gray-200',
}

const CONFIDENCE_LABEL: Record<string, string> = {
  certain:      'Certain',
  probable:     'Probable',
  illustrative: 'Illustrative',
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4 animate-pulse">
      <div className="h-4 bg-gray-100 rounded w-48" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-32 bg-gray-100 rounded-lg" />
        <div className="h-32 bg-gray-100 rounded-lg" />
      </div>
      <div className="h-10 bg-gray-100 rounded" />
    </div>
  )
}

// ── Metric pill ───────────────────────────────────────────────────────────────
function MetricPill({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-2 rounded-lg bg-gray-50 border border-gray-100 min-w-0">
      <span className="text-xs text-gray-500 whitespace-nowrap">{label}</span>
      <span className="text-sm font-semibold text-gray-800 mt-0.5">{fmtK(value)}</span>
      {sub && <span className="text-[10px] text-gray-400 mt-0.5">{sub}</span>}
    </div>
  )
}

// ── Confidence badge ──────────────────────────────────────────────────────────
function ConfidenceBadge({ level }: { level: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${CONFIDENCE_BADGE[level] ?? CONFIDENCE_BADGE.illustrative}`}>
      {CONFIDENCE_LABEL[level] ?? level}
    </span>
  )
}

// ── Outside item row ──────────────────────────────────────────────────────────
function OutsideStructureRow({ item }: { item: OutsideStructureItem }) {
  const label = item.exclusion_type === 'excluded_irrevocable'
    ? 'Irrevocable transfer'
    : item.exclusion_type === 'excluded_gifted'
    ? 'Gifted'
    : 'Excluded'
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <div className="flex flex-col min-w-0">
        <span className="text-gray-700 truncate">{item.name}</span>
        <span className="text-gray-400 capitalize">{item.asset_class} · {label}</span>
      </div>
      <span className="font-medium text-gray-700 ml-2 shrink-0">{fmt(item.value)}</span>
    </div>
  )
}

// Strategy condition notes — shown for illustrative strategies
const STRATEGY_CONDITIONS: Record<string, string> = {
  grat:  'Projected remainder after term — requires grantor to survive GRAT term',
  crt:   'Projected remainder to charity — requires trust completion',
  clat:  'Projected remainder to heirs — requires trust completion',
  gsl:   'Projected after sale completion',
}

function OutsideStrategyRow({ item }: { item: OutsideStrategyItem }) {
  const condition = item.confidence_level === 'illustrative'
    ? (STRATEGY_CONDITIONS[item.strategy_source] ?? 'Projected future transfer — conditions must be met')
    : null
  const effectiveYear = item.effective_year
  return (
    <div className="flex flex-col text-xs py-1.5 border-b border-gray-50 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-gray-700 capitalize font-medium">
            {item.strategy_source.replace(/_/g, ' ').replace(/\w/g, c => c.toUpperCase())}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <ConfidenceBadge level={item.confidence_level} />
            {effectiveYear && (
              <span className="text-[10px] text-gray-400">est. {effectiveYear}</span>
            )}
          </div>
        </div>
        <span className="font-medium text-gray-700 shrink-0">{fmt(item.amount)}</span>
      </div>
      {condition && (
        <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed italic">{condition}</p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
interface EstateCompositionCardProps {
  /** Pass householdId to fetch client-side, OR pass composition for SSR */
  householdId?: string
  /** Pre-fetched composition — skips the API call */
  composition?: EstateComposition
  /** Label shown above the card */
  label?: string
  /** 'current' | 'projected YYYY' */
  snapshotLabel?: string
  /** Show the three-tier metric row (Gross / Net / Taxable) */
  showMetrics?: boolean
  /** Show the expandable breakdown */
  showBreakdown?: boolean
  /** Advisor portal: prominent tax callout + collapsed empty outside panel */
  variant?: 'default' | 'advisor'
  /** Optional advisor override from horizon actual set (ENG-1) */
  horizonComposition?: {
    grossEstate: number
    outsideStrategyTotal: number
    insideTaxableEstate: number
    estimatedFederalTax: number
    estimatedStateTax: number
    estimatedTotalTax: number
    federalExemption: number
    lifetimeGiftsUsed: number
  }
}

export default function EstateCompositionCard({
  householdId,
  composition: compositionProp,
  label = 'Your Estate',
  snapshotLabel = 'Current snapshot',
  showMetrics = true,
  showBreakdown = true,
  variant = 'default',
  horizonComposition,
}: EstateCompositionCardProps) {
  // ENG-1 AUDIT NOTE:
  // calculate_estate_composition with p_source_role='consumer' excludes
  // advisor rows that are consumer_accepted. For advisor displays, horizonComposition
  // (from strategyMappers actualStrategies) overrides key totals for parity.
  const [composition, setComposition] = useState<EstateComposition | null>(compositionProp ?? null)
  const [loading, setLoading] = useState(!compositionProp)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (compositionProp) {
      const timeoutId = window.setTimeout(() => {
        setComposition(compositionProp)
        setLoading(false)
      }, 0)
      return () => window.clearTimeout(timeoutId)
    }
    if (!householdId) {
      return
    }

    const loadingTimeoutId = window.setTimeout(() => setLoading(true), 0)
    fetch('/api/estate-composition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId }),
    })
      .then((r) => r.json())
      .then((data: EstateComposition) => {
        if (!data.success) {
          setError(data.error ?? 'Failed to load estate composition')
        } else {
          setComposition(data)
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
    return () => window.clearTimeout(loadingTimeoutId)
  }, [householdId, compositionProp])

  if (loading) return <Skeleton />

  if (error || !composition) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
        Unable to load estate composition. {error}
      </div>
    )
  }

  const {
    inside_total,
    inside_financial,
    inside_real_estate,
    inside_business_gross,
    inside_insurance,
    inside_liquid,
    inside_illiquid,
    outside_structure_total,
    outside_structure_items,
    outside_strategy_total,
    outside_strategy_items,
    gross_estate,
    net_estate,
    liabilities,
    taxable_estate,
    exemption_available,
    admin_expense,
    marital_deduction,
    adjusted_taxable_gifts = 0,
    estimated_tax,
    estimated_tax_federal,
    estimated_tax_state,
  } = composition

  const displayInsideTotal = horizonComposition?.insideTaxableEstate ?? inside_total
  const displayOutsideStrategyTotal = horizonComposition?.outsideStrategyTotal ?? outside_strategy_total
  const displayGrossEstate = horizonComposition?.grossEstate ?? gross_estate
  const displayTaxableEstate = horizonComposition?.insideTaxableEstate ?? taxable_estate
  const displayEstimatedFederalTax = horizonComposition?.estimatedFederalTax ?? (estimated_tax_federal ?? 0)
  const displayEstimatedStateTax = horizonComposition?.estimatedStateTax ?? (estimated_tax_state ?? 0)
  const displayEstimatedTax = horizonComposition?.estimatedTotalTax ?? estimated_tax
  const displayExemptionAvailable = horizonComposition?.federalExemption ?? exemption_available
  const displayExemptionRemaining = Math.max(0, displayExemptionAvailable - displayTaxableEstate)
  const outside_total = outside_structure_total + displayOutsideStrategyTotal
  const transfers = [...outside_structure_items, ...outside_strategy_items]
  const hasOutsideEstateContent = outside_total > 0 || transfers.length > 0
  const hasOutside = outside_total > 0
  const hasStrategies = outside_strategy_items.length > 0
  const hasStructural = outside_structure_items.length > 0
  const liquidPct = displayInsideTotal > 0 ? Math.round((inside_liquid / displayInsideTotal) * 100) : 0
  const isAdvisor = variant === 'advisor'

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100">
        {isAdvisor ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {label}
                  <span className="ml-2 text-xs font-normal text-gray-400">{snapshotLabel}</span>
                </h2>
              </div>
              {displayEstimatedTax > 0 ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-right min-w-[180px] shrink-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-red-500 mb-0.5">
                    Estimated Tax Liability
                  </p>
                  <p className="text-xl font-bold text-red-700 tabular-nums">{fmt(displayEstimatedTax)}</p>
                </div>
              ) : (
                <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-0.5 font-medium shrink-0">
                  No federal estate tax
                </span>
              )}
            </div>
            {horizonComposition && horizonComposition.outsideStrategyTotal > 0 && (
              <div className="mb-1 mt-2 flex items-center gap-1.5 text-[11px] text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Includes {fmt(horizonComposition.outsideStrategyTotal)} in accepted strategies
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-gray-800">{label}</span>
              <span className="ml-2 text-xs text-gray-400">{snapshotLabel}</span>
            </div>
            {displayEstimatedTax === 0 ? (
              <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-0.5 font-medium">
                No federal estate tax
              </span>
            ) : (
              <span className="text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2.5 py-0.5 font-medium">
                Est. tax: {fmt(displayEstimatedTax)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main two-panel grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">

        {/* ── INSIDE panel ─────────────────────────────────────────────────── */}
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
              Inside Taxable Estate
            </span>
            <span className="text-lg font-bold text-blue-900">{fmtK(displayInsideTotal)}</span>
          </div>

          {/* Asset breakdown */}
          <div className="space-y-1.5">
            {inside_financial > 0 && (
              <div className="flex justify-between text-xs text-gray-600">
                <span>Financial assets</span>
                <span className="font-medium">{fmt(inside_financial)}</span>
              </div>
            )}
            {inside_real_estate > 0 && (
              <div className="flex justify-between text-xs text-gray-600">
                <span>Real estate</span>
                <span className="font-medium">{fmt(inside_real_estate)}</span>
              </div>
            )}
            {inside_business_gross > 0 && (
              <div className="flex justify-between text-xs text-gray-600">
                <span>Business interests</span>
                <span className="font-medium">{fmt(inside_business_gross)}</span>
              </div>
            )}
            {inside_insurance > 0 && (
              <div className="flex justify-between text-xs text-gray-600">
                <span>Life insurance</span>
                <span className="font-medium">{fmt(inside_insurance)}</span>
              </div>
            )}
          </div>

          {/* Liquid / Illiquid bar */}
          <div className="pt-1">
            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
              <span>Liquid {liquidPct}%</span>
              <span>Illiquid {100 - liquidPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full"
                style={{ width: `${liquidPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>{fmtK(inside_liquid)}</span>
              <span>{fmtK(inside_illiquid)}</span>
            </div>
          </div>

          {/* Federal exemption headroom */}
          <div className="pt-2 border-t border-gray-100 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">{FEDERAL_EXEMPTION_AFTER_GIFTS_LABEL}</span>
              <span className="font-medium text-gray-700">{fmt(displayExemptionAvailable)}</span>
            </div>
            <div className="flex justify-between text-xs mt-0.5">
              <span className="text-gray-500">{HEADROOM_BEFORE_FEDERAL_TAX_LABEL}</span>
              <span className={`font-semibold ${displayExemptionRemaining > 0 ? 'text-green-700' : 'text-red-600'}`}>
                {fmt(displayExemptionRemaining)}
              </span>
            </div>
          </div>
        </div>

        {/* ── OUTSIDE panel ────────────────────────────────────────────────── */}
        {isAdvisor && !hasOutsideEstateContent ? (
          <div className="p-5">
            <div className="flex items-center justify-between rounded-lg border border-dashed border-gray-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500">Outside Taxable Estate</span>
                <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded px-2 py-0.5">
                  No transfers
                </span>
              </div>
              <span className="text-sm text-gray-300">$0</span>
            </div>
          </div>
        ) : (
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-green-800 uppercase tracking-wide">
              Outside Taxable Estate
            </span>
            <span className={`text-lg font-bold ${hasOutside ? 'text-green-800' : 'text-gray-400'}`}>
              {fmtK(outside_total)}
            </span>
          </div>

          {!hasOutside && (
            <p className="text-xs text-gray-400 leading-relaxed">
              No completed transfers or recommended strategies yet. Assets moved through
              trusts, gifting programs, or other strategies will appear here.
            </p>
          )}

          {/* Structural transfers */}
          {hasStructural && (
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                Completed transfers
              </span>
              {outside_structure_items.map((item, i) => (
                <OutsideStructureRow key={i} item={item} />
              ))}
              <div className="flex justify-between text-xs font-semibold pt-1 border-t border-gray-100">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-green-700">{fmt(outside_structure_total)}</span>
              </div>
            </div>
          )}

          {/* Strategy items */}
          {hasStrategies && (
            <div className="space-y-0.5 pt-2">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                Advisor-recommended strategies
              </span>
              {outside_strategy_items.map((item, i) => (
                <OutsideStrategyRow key={i} item={item} />
              ))}
              <div className="flex justify-between text-xs font-semibold pt-1 border-t border-gray-100">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-gray-700">{fmt(displayOutsideStrategyTotal)}</span>
              </div>
              <p className="text-[10px] text-gray-400 pt-1 leading-relaxed">
                <span className="font-medium text-green-700">Certain</span> = transfer complete.{' '}
                <span className="font-medium text-blue-700">Probable</span> = in progress.{' '}
                <span className="font-medium text-gray-600">Illustrative</span> = projected future transfer,
                conditions must be met. Consult your advisor and attorney before acting.
              </p>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Three-tier metric row */}
      {showMetrics && (
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <div className="flex flex-wrap gap-2 justify-between">
            <MetricPill label="Gross Estate" value={displayGrossEstate} />
            <MetricPill label="Net Estate" value={net_estate} sub="after liabilities" />
            <MetricPill label="Admin Expense" value={admin_expense} sub="2% est." />
            {adjusted_taxable_gifts > 0 && (
              <MetricPill label="Adj. Taxable Gifts" value={adjusted_taxable_gifts} sub="added to taxable" />
            )}
            {marital_deduction > 0 && (
              <MetricPill label="Marital Deduction" value={marital_deduction} sub="at first death" />
            )}
            <MetricPill label="Taxable Estate" value={displayTaxableEstate} />
          </div>
        </div>
      )}

      {/* Expandable breakdown toggle */}
      {showBreakdown && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-full px-5 py-2.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between"
          >
            <span>{expanded ? 'Hide' : 'Show'} full breakdown</span>
            <svg
              className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expanded && (
            <div className="px-5 pb-4 space-y-2 border-t border-gray-100 bg-gray-50">
              <p className="text-[10px] text-gray-400 pt-3 uppercase tracking-wide font-semibold">
                How your taxable estate is calculated (IRS basis)
              </p>
              {[
                {
                  label: 'Gross Estate (IRS basis)',
                  value: gross_estate,
                  sign: '',
                  bold: true,
                  note: 'Real estate at full market value',
                },
                {
                  label: '− Mortgage & liabilities',
                  value: liabilities ?? (gross_estate - net_estate),
                  sign: '−',
                  note: 'Mortgage + other debts',
                },
                {
                  label: '− Admin expense (est.)',
                  value: admin_expense,
                  sign: '−',
                  note: `${Math.round((composition.admin_expense_pct ?? 0.02) * 100)}% of gross`,
                },
                {
                  label: '+ Adj. Taxable Gifts',
                  value: adjusted_taxable_gifts,
                  sign: '+',
                  hide: adjusted_taxable_gifts === 0,
                },
                {
                  label: '= Taxable Estate',
                  value: displayTaxableEstate,
                  sign: '=',
                  bold: true,
                },
                {
                  label: `− ${FEDERAL_EXEMPTION_AFTER_GIFTS_LABEL}`,
                  value: displayExemptionAvailable,
                  sign: '−',
                },
                {
                  label: '= Est. Federal Tax',
                  value: displayEstimatedFederalTax,
                  sign: '=',
                  bold: true,
                  color: displayEstimatedFederalTax > 0 ? 'text-red-600' : 'text-green-700',
                },
                {
                  label: '= Est. State Tax',
                  value: displayEstimatedStateTax,
                  sign: '=',
                  bold: true,
                  hide: displayEstimatedStateTax === 0,
                  color: displayEstimatedStateTax > 0 ? 'text-red-600' : 'text-green-700',
                },
              ]
                .filter((r) => !r.hide)
                .map((row, i) => (
                  <div key={i} className={`flex justify-between text-xs ${row.bold ? 'font-semibold border-t border-gray-200 pt-1.5' : 'text-gray-600'}`}>
                    <div className="flex flex-col">
                      <span>{row.label}</span>
                      {row.note && (
                        <span className="text-[10px] text-gray-400">{row.note}</span>
                      )}
                    </div>
                    <span className={row.color ?? ''}>
                      {row.sign === '−' ? `(${fmt(row.value)})` : fmt(row.value)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
