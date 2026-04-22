'use client'

// app/(dashboard)/estate-tax/_estate-tax-client.tsx
// Redesigned Session 27 — Estate Tax page
//
// Key changes from prior version:
//   • Gross estate comes from calculate_estate_composition RPC (correct FMV)
//   • §121 exclusion removed from gross estate — it's an income tax concept,
//     not an estate tax concept. Informational note shown in RE section instead.
//   • Businesses and insurance now included (were missing before)
//   • State tax uses composition.gross_estate as base (not §121-adjusted value)
//   • Strategy impact section shown only when strategy_line_items exist
//   • EstateCompositionCard shown at top
//   • Federal section shows "no tax" state clearly when under exemption

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  computeFederalEstateTax,
  computeStateEstateTax,
  computeStateInheritanceTaxTotal,
  type BeneficiaryClass,
  type EstateTaxBracket,
  type StateEstateTaxBracket,
  type StateInheritanceTaxRule,
} from '@/lib/calculations/estate-tax'
import { computeStateEstateTaxFromBrackets } from '@/lib/calculations/estate-tax-projection'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import EstateCompositionCard from '@/components/estate/EstateCompositionCard'
import type { EstateComposition, OutsideStrategyItem } from '@/lib/estate/types'

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function num(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v !== '') return Number(v) || 0
  return 0
}

function formatDollars(n: number) {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

function filingForTax(household: Record<string, unknown> | null): string {
  const fs = household?.filing_status as string | null
  if (!fs) return 'single'
  if (fs === 'mfj' || fs === 'qw' || fs === 'married_filing_jointly' || fs === 'married_joint') {
    return 'married_joint'
  }
  return 'single'
}

function trustsExcludedSum(trusts: EstateTaxTrustRow[]): number {
  return trusts.reduce((s, t) => {
    if (t.excludes_from_estate === true) {
      return s + num(t.funding_amount ?? t.excluded_from_estate)
    }
    if (t.excludes_from_estate === false) return s
    return s + num(t.excluded_from_estate)
  }, 0)
}

const STATE_ESTATE_TAX_STATES = new Set([
  'CT', 'DC', 'HI', 'IL', 'ME', 'MD', 'MA', 'MN', 'NY', 'OR', 'RI', 'VT', 'WA',
])
const STATE_INHERITANCE_TAX_STATES = new Set(['IA', 'KY', 'MD', 'NE', 'NJ', 'PA'])

const BENEFICIARY_CLASS_LABELS: Record<BeneficiaryClass, string> = {
  spouse: 'Spouse',
  child: 'Children / Lineal descendants',
  sibling: 'Siblings',
  other: 'Other beneficiaries',
}

const CONFIDENCE_COLORS: Record<string, string> = {
  certain:      'bg-green-100 text-green-800 border-green-200',
  probable:     'bg-blue-100 text-blue-800 border-blue-200',
  illustrative: 'bg-gray-100 text-gray-600 border-gray-200',
}

// ─────────────────────────────────────────────────────────────
// Presentational helpers
// ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: 'green' | 'red' | 'amber'
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${
        highlight === 'green' ? 'text-green-600'
        : highlight === 'red' ? 'text-red-600'
        : highlight === 'amber' ? 'text-amber-600'
        : 'text-neutral-900'
      }`}>
        {value}
      </p>
      {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function BreakdownRow({
  label,
  value,
  muted,
  sub,
  bold,
  color,
}: {
  label: string
  value: number
  muted?: boolean
  sub?: string
  bold?: boolean
  color?: string
}) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-3 border-b border-neutral-100 last:border-0 ${muted ? 'text-neutral-500' : ''}`}>
      <div>
        <span className={bold ? 'text-sm font-semibold text-neutral-900' : muted ? 'text-sm' : 'text-sm font-medium text-neutral-800'}>
          {label}
        </span>
        {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
      </div>
      <span className={`text-sm font-semibold tabular-nums ${color ?? (muted ? 'text-neutral-500' : 'text-neutral-900')}`}>
        {muted && value >= 0 ? '−' : ''}{formatDollars(Math.abs(value))}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type EstateTaxTrustRow = {
  id: string
  owner_id: string
  name: string
  excluded_from_estate?: unknown
  trust_type?: string
  grantor?: string | null
  trustee?: string | null
  funding_amount?: unknown
  state?: string | null
  is_irrevocable?: boolean
  excludes_from_estate?: boolean
  created_at?: string
  updated_at?: string
}

const TRUST_TYPES = [
  { value: 'revocable',      label: 'Revocable' },
  { value: 'irrevocable',    label: 'Irrevocable' },
  { value: 'qtip',           label: 'QTIP' },
  { value: 'bypass',         label: 'Bypass' },
  { value: 'charitable',     label: 'Charitable' },
  { value: 'special_needs',  label: 'Special needs' },
] as const

const inputClass =
  'block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500'

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export default function EstateTaxClient({
  liabilities,
  trusts: initialTrusts,
  household,
  brackets: bracketRows,
  stateEstateTaxRules: stateEstateTaxRows,
  stateInheritanceTaxRules: stateInheritanceTaxRuleRows,
  giftingAnnualUsed,
  giftingAnnualRemaining,
  giftingAnnualLoggedTotal,
  giftingTaxYear,
  giftingSplitSelected,
  giftingPerRecipientLimit,
  giftingExcessOverLimit,
  // Pre-fetched from page.tsx via classifyEstateAssets
  composition: compositionProp,
}: {
  liabilities: Record<string, unknown>[]
  trusts: EstateTaxTrustRow[]
  household: Record<string, unknown> | null
  brackets: Record<string, unknown>[]
  stateEstateTaxRules: Record<string, unknown>[]
  stateInheritanceTaxRules: Record<string, unknown>[]
  primaryResidenceValue?: number | null
  giftingAnnualCapacity?: number | null
  giftingAnnualUsed?: number | null
  giftingAnnualRemaining?: number | null
  giftingAnnualLoggedTotal?: number | null
  giftingTaxYear?: number | null
  giftingSplitSelected?: boolean
  giftingPerRecipientLimit?: number | null
  giftingExcessOverLimit?: number | null
  // New — from classifyEstateAssets RPC
  composition?: EstateComposition | null
  // Legacy props kept for backwards compat — no longer used for gross estate
  assets?: Record<string, unknown>[]
  realEstate?: Record<string, unknown>[]
  businesses?: Record<string, unknown>[]
}) {
  const router = useRouter()
  const [trusts, setTrusts] = useState<EstateTaxTrustRow[]>(initialTrusts)
  useEffect(() => { setTrusts(initialTrusts) }, [initialTrusts])

  const [showTrustModal, setShowTrustModal] = useState(false)
  const [editTrust, setEditTrust] = useState<EstateTaxTrustRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Composition state — use prop if available, else fetch client-side
  const [composition, setComposition] = useState<EstateComposition | null>(compositionProp ?? null)
  const [compositionLoading, setCompositionLoading] = useState(!compositionProp)

  useEffect(() => {
    if (compositionProp) {
      setComposition(compositionProp)
      setCompositionLoading(false)
      return
    }
    // Fallback: fetch client-side if page didn't pass it as a prop
    const householdId = household?.id as string | null
    if (!householdId) return
    setCompositionLoading(true)
    fetch('/api/estate-composition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId }),
    })
      .then(r => r.json())
      .then((data: EstateComposition) => {
        if (data.success) setComposition(data)
      })
      .catch(console.error)
      .finally(() => setCompositionLoading(false))
  }, [compositionProp, household?.id])

  // Strategy line items — load to show strategy impact section
  const [strategyItems, setStrategyItems] = useState<OutsideStrategyItem[]>([])
  useEffect(() => {
    if (composition?.outside_strategy_items?.length) {
      setStrategyItems(composition.outside_strategy_items)
    }
  }, [composition])

  // ── Gifting inputs ──────────────────────────────────────────
  const [annualGifting, setAnnualGifting] = useState(19000)
  const [giftingYears, setGiftingYears] = useState(10)

  // ── Inheritance tax: beneficiary allocation sliders ──────────
  const [inheritShares, setInheritShares] = useState<Record<BeneficiaryClass, number>>({
    spouse: 50,
    child: 50,
    sibling: 0,
    other: 0,
  })

  const filing = filingForTax(household)
  const recommendedAnnualGifting =
    filing === 'married_joint' && giftingSplitSelected ? 38000 : 19000

  useEffect(() => {
    if (giftingAnnualUsed != null && giftingAnnualUsed > 0) {
      setAnnualGifting(Math.round(giftingAnnualUsed))
      return
    }
    setAnnualGifting(recommendedAnnualGifting)
  }, [giftingAnnualUsed, recommendedAnnualGifting])

  const syncedEligibleAnnual = Math.max(0, giftingAnnualUsed ?? 0)
  const syncedLifetimeOverflow = Math.max(0, giftingExcessOverLimit ?? 0)
  const syncedGiftTotalReduction = syncedEligibleAnnual + syncedLifetimeOverflow
  const useSyncedGifting = syncedGiftTotalReduction > 0
  const effectiveAnnualGifting = useSyncedGifting ? syncedGiftTotalReduction : annualGifting
  const effectiveGiftingYears = useSyncedGifting ? 1 : giftingYears

  const statePrimary = (household?.state_primary as string | null) ?? ''
  const stateCompare = (household?.state_compare as string | null) ?? ''

  // ── Gross estate from RPC — single source of truth ─────────
  // Full FMV: financial + RE FMV + business (ownership-weighted) + insurance death benefit
  // §121 does NOT apply here — it's an income tax concept for capital gains on sale,
  // not an estate tax concept. The primary residence is included at full FMV per IRC §2031.
  const grossEstate = composition?.gross_estate ?? 0
  const totalLiabilities = useMemo(
    () => liabilities.reduce((s, l) => s + num(l.balance), 0),
    [liabilities],
  )
  const trustsExcluded = useMemo(() => trustsExcludedSum(trusts), [trusts])

  // ── Federal brackets ────────────────────────────────────────
  const brackets: EstateTaxBracket[] = useMemo(() => {
    const latestYear = Math.max(...bracketRows.map(b => num(b.tax_year)), 0)
    return bracketRows
      .filter(b => num(b.tax_year) === latestYear)
      .map((b) => ({
        min_amount: num(b.min_amount),
        max_amount: num(b.max_amount),
        rate_pct: num(b.rate_pct),
      }))
  }, [bracketRows])

  // ── Federal result ──────────────────────────────────────────
  const federalResult = brackets.length > 0 && grossEstate > 0
    ? computeFederalEstateTax(
        grossEstate,
        totalLiabilities,
        trustsExcluded,
        filing,
        brackets,
        effectiveAnnualGifting,
        effectiveGiftingYears,
      )
    : null

  // ── Federal result WITH strategies applied ──────────────────
  const strategyReductionTotal = strategyItems
    .filter(s => s.confidence_level !== 'illustrative')
    .reduce((sum, s) => sum + s.amount, 0)

  const federalResultWithStrategies = brackets.length > 0 && grossEstate > 0 && strategyReductionTotal > 0
    ? computeFederalEstateTax(
        Math.max(0, grossEstate - strategyReductionTotal),
        totalLiabilities,
        trustsExcluded,
        filing,
        brackets,
        effectiveAnnualGifting,
        effectiveGiftingYears,
      )
    : null

  // ── State estate tax brackets ────────────────────────────────
  const stateEstateBrackets: StateEstateTaxBracket[] = useMemo(() => {
    const latestYear = Math.max(...stateEstateTaxRows.map(r => num(r.tax_year)), 0)
    return stateEstateTaxRows
      .filter(r => num(r.tax_year) === latestYear)
      .map((r) => ({
        state:            String(r.state ?? '').trim().toUpperCase(),
        min_amount:       num(r.min_amount),
        max_amount:       num(r.max_amount),
        rate_pct:         num(r.rate_pct),
        exemption_amount: num(r.exemption_amount),
      }))
  }, [stateEstateTaxRows])

  // ── State inheritance tax rules ──────────────────────────────
  const stateInheritanceRules: StateInheritanceTaxRule[] = useMemo(() => {
    const latestYear = Math.max(...stateInheritanceTaxRuleRows.map(r => num(r.tax_year)), 0)
    return stateInheritanceTaxRuleRows
      .filter(r => num(r.tax_year) === latestYear)
      .map((r) => ({
        state:             String(r.state ?? '').trim().toUpperCase(),
        beneficiary_class: String(r.beneficiary_class ?? ''),
        min_amount:        num(r.min_amount),
        max_amount:        num(r.max_amount),
        rate_pct:          num(r.rate_pct),
        exemption_amount:  num(r.exemption_amount),
      }))
  }, [stateInheritanceTaxRuleRows])

  // ── State estate tax results ─────────────────────────────────
  // Uses gross_estate from composition RPC as base — consistent with all other pages.
  // computeStateEstateTaxFromBrackets uses the bracket exemption amount directly.
  const isMFJ = filing === 'married_joint'
  const hasSpouse = household?.has_spouse === true

  const primaryStateBrackets = useMemo(
    () => stateEstateBrackets.filter(b => b.state === statePrimary?.toUpperCase()),
    [stateEstateBrackets, statePrimary],
  )

  const primaryStateExemption = primaryStateBrackets[0]?.exemption_amount ?? 0

  const primaryStateTax = useMemo(() => {
    if (!statePrimary || !STATE_ESTATE_TAX_STATES.has(statePrimary.toUpperCase())) return null
    if (isMFJ && hasSpouse) {
      // First death: marital deduction applies — no state estate tax
      return {
        state:            statePrimary.toUpperCase(),
        state_taxable:    0,
        state_exemption:  primaryStateExemption,
        state_estate_tax: 0,
        is_first_death:   true,
      }
    }
    return {
      ...computeStateEstateTax(
        statePrimary.toUpperCase(),
        num(federalResult?.taxable_estate),
        stateEstateBrackets,
      ),
      is_first_death: false,
    }
  }, [statePrimary, isMFJ, hasSpouse, federalResult, stateEstateBrackets, primaryStateExemption])

  const compareStateBrackets = useMemo(
    () => stateEstateBrackets.filter(b => b.state === stateCompare?.toUpperCase()),
    [stateEstateBrackets, stateCompare],
  )

  const compareStateTax = useMemo(() => {
    const sc = stateCompare?.toUpperCase()
    if (!sc || sc === statePrimary?.toUpperCase()) return null
    if (!STATE_ESTATE_TAX_STATES.has(sc)) return null
    if (isMFJ && hasSpouse) {
      return {
        state:            sc,
        state_taxable:    0,
        state_exemption:  compareStateBrackets[0]?.exemption_amount ?? 0,
        state_estate_tax: 0,
        is_first_death:   true,
      }
    }
    return {
      ...computeStateEstateTax(sc, num(federalResult?.taxable_estate), stateEstateBrackets),
      is_first_death: false,
    }
  }, [stateCompare, statePrimary, isMFJ, hasSpouse, federalResult, stateEstateBrackets, compareStateBrackets])

  const showComparison =
    !!stateCompare &&
    stateCompare.toUpperCase() !== statePrimary?.toUpperCase() &&
    (compareStateTax !== null || true)

  // ── State inheritance tax ────────────────────────────────────
  const totalForInheritance = isMFJ ? grossEstate * 0.5 : grossEstate
  const inheritanceShareDollars = useMemo<Partial<Record<BeneficiaryClass, number>>>(() => {
    const total = inheritShares.spouse + inheritShares.child + inheritShares.sibling + inheritShares.other
    if (total === 0) return {}
    return {
      spouse:  (inheritShares.spouse  / total) * totalForInheritance,
      child:   (inheritShares.child   / total) * totalForInheritance,
      sibling: (inheritShares.sibling / total) * totalForInheritance,
      other:   (inheritShares.other   / total) * totalForInheritance,
    }
  }, [inheritShares, totalForInheritance])

  const primaryInheritanceTax = useMemo(() => {
    if (!statePrimary || !STATE_INHERITANCE_TAX_STATES.has(statePrimary.toUpperCase())) return null
    return computeStateInheritanceTaxTotal(statePrimary.toUpperCase(), inheritanceShareDollars, stateInheritanceRules)
  }, [statePrimary, inheritanceShareDollars, stateInheritanceRules])

  const compareInheritanceTax = useMemo(() => {
    const sc = stateCompare?.toUpperCase()
    if (!sc || sc === statePrimary?.toUpperCase()) return null
    if (!STATE_INHERITANCE_TAX_STATES.has(sc)) return null
    return computeStateInheritanceTaxTotal(sc, inheritanceShareDollars, stateInheritanceRules)
  }, [stateCompare, statePrimary, inheritanceShareDollars, stateInheritanceRules])

  // ── Trust CRUD ───────────────────────────────────────────────
  const loadTrusts = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error: e } = await supabase
      .from('trusts')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    if (e) setError(e.message)
    else setTrusts((data as EstateTaxTrustRow[]) ?? [])
  }, [])

  function updateInheritShare(cls: BeneficiaryClass, pct: number) {
    setInheritShares((prev) => ({ ...prev, [cls]: Math.max(0, Math.min(100, pct)) }))
  }

  const totalSliderPct =
    inheritShares.spouse + inheritShares.child + inheritShares.sibling + inheritShares.other

  const hasStrategies = strategyItems.length > 0
  const taxSavingsFromStrategies =
    federalResult && federalResultWithStrategies
      ? Math.max(0, federalResult.net_estate_tax - federalResultWithStrategies.net_estate_tax)
      : 0

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">

      {/* ── Header ── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Estate Tax</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Federal and state estate tax exposure. Strategies marked by your advisor appear below.
        </p>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {/* ── Estate Composition Card ── */}
      {compositionLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse mb-6">
          <div className="h-4 bg-gray-100 rounded w-48 mb-4" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-32 bg-gray-100 rounded-lg" />
            <div className="h-32 bg-gray-100 rounded-lg" />
          </div>
        </div>
      ) : composition ? (
        <div className="mb-6">
          <EstateCompositionCard
            composition={composition}
            label="Your Estate"
            snapshotLabel="Current snapshot"
          />
        </div>
      ) : null}

      {/* ── Federal Estate Summary ── */}
      <CollapsibleSection
        title="Federal estate summary"
        subtitle="Gross estate, taxable estate, exemption, and federal tax"
        defaultOpen={true}
        storageKey="estate-tax-federal-summary"
      >
        {grossEstate === 0 && !compositionLoading ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            <p className="font-semibold">No estate data found</p>
            <p className="mt-1">Add assets, real estate, and businesses to see your estate tax picture.</p>
          </div>
        ) : (
          <>
            {/* Federal summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <SummaryCard
                label="Gross Estate"
                value={formatDollars(grossEstate)}
                sub="Financial + real estate FMV + business + insurance"
              />
              <SummaryCard
                label="Taxable Estate"
                value={federalResult ? formatDollars(federalResult.taxable_estate) : '—'}
                sub="After liabilities, trusts & gifting"
              />
              <SummaryCard
                label="Federal Exemption"
                value={federalResult ? formatDollars(federalResult.exemption_used) : '—'}
                sub={filing === 'married_joint' ? '$30M MFJ (OBBBA 2026)' : '$15M single (OBBBA 2026)'}
              />
              <SummaryCard
                label="Federal Estate Tax"
                value={federalResult ? formatDollars(federalResult.net_estate_tax) : '—'}
                sub={
                  federalResult && federalResult.net_estate_tax > 0
                    ? 'Estimated federal transfer tax'
                    : 'No estimated federal tax due'
                }
                highlight={!federalResult ? undefined : federalResult.net_estate_tax > 0 ? 'red' : 'green'}
              />
            </div>

            {/* No-tax green state */}
            {federalResult && federalResult.net_estate_tax === 0 && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800 mb-4">
                <p className="font-semibold">No federal estate tax estimated</p>
                <p className="mt-1 leading-relaxed">
                  Your taxable estate of {formatDollars(federalResult.taxable_estate)} is below the{' '}
                  {filing === 'married_joint' ? '$30,000,000 MFJ' : '$15,000,000 single'} federal exemption
                  under the OBBBA 2026. Federal estate tax becomes a consideration only when your taxable
                  estate exceeds this threshold.
                </p>
                {composition && composition.exemption_remaining > 0 && (
                  <p className="mt-1.5 text-green-700">
                    Exemption remaining: <span className="font-semibold">{formatDollars(composition.exemption_remaining)}</span>
                  </p>
                )}
              </div>
            )}

            {/* Note about §121 */}
            {composition && composition.inside_real_estate > 0 && (
              <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-xs text-sky-800 mb-4">
                <span className="font-semibold">Note on primary residence: </span>
                Your real estate is included at full fair market value in the gross estate per IRC §2031.
                The §121 income tax exclusion (up to $500,000 MFJ on capital gains) applies only if
                the estate or heirs later <em>sell</em> the property — not to estate tax inclusion itself.
                Your estate attorney can advise on post-death sale planning.
              </div>
            )}
          </>
        )}
      </CollapsibleSection>

      {/* ── Strategy Impact — only shown when strategies exist ── */}
      {hasStrategies && (
        <CollapsibleSection
          title="Strategy impact"
          subtitle="How your advisor's recommended strategies affect your estate tax"
          defaultOpen={true}
          storageKey="estate-tax-strategy-impact"
        >
          <div className="space-y-4">
            {/* Before / After summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-1">
                  Without strategies
                </p>
                <p className="text-xl font-bold text-neutral-900">
                  {federalResult ? formatDollars(federalResult.net_estate_tax) : '—'}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">Est. federal tax</p>
              </div>
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-green-700 mb-1">
                  With strategies
                </p>
                <p className="text-xl font-bold text-green-700">
                  {federalResultWithStrategies
                    ? formatDollars(federalResultWithStrategies.net_estate_tax)
                    : federalResult
                    ? formatDollars(federalResult.net_estate_tax)
                    : '—'}
                </p>
                <p className="text-xs text-green-600 mt-0.5">Est. federal tax</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-blue-700 mb-1">
                  Potential savings
                </p>
                <p className="text-xl font-bold text-blue-700">
                  {formatDollars(taxSavingsFromStrategies)}
                </p>
                <p className="text-xs text-blue-600 mt-0.5">Est. federal tax reduction</p>
              </div>
            </div>

            {/* Strategy line items */}
            <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
                <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
                  Advisor-recommended strategies
                </p>
              </div>
              <div className="divide-y divide-neutral-100">
                {strategyItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-sm font-medium text-neutral-800 capitalize">
                        {item.strategy_source.replace(/_/g, ' ')}
                      </span>
                      <span className={`inline-flex w-fit items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${CONFIDENCE_COLORS[item.confidence_level] ?? CONFIDENCE_COLORS.illustrative}`}>
                        {item.confidence_level.charAt(0).toUpperCase() + item.confidence_level.slice(1)}
                      </span>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <span className="text-sm font-semibold text-green-700">
                        −{formatDollars(item.amount)}
                      </span>
                      <p className="text-xs text-neutral-400">estate reduction</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-neutral-200 bg-neutral-50 flex justify-between items-center">
                <span className="text-xs font-semibold text-neutral-700">
                  Total estate reduction (certain + probable)
                </span>
                <span className="text-sm font-bold text-green-700">
                  −{formatDollars(strategyReductionTotal)}
                </span>
              </div>
            </div>

            <p className="text-xs text-neutral-400">
              Illustrative strategies are excluded from the tax reduction calculation. Consult your
              advisor and attorney before implementing any strategy.
            </p>
          </div>
        </CollapsibleSection>
      )}

      {/* ── Federal Breakdown ── */}
      <CollapsibleSection
        title="Federal estate breakdown"
        defaultOpen={false}
        storageKey="estate-tax-federal-breakdown"
      >
        <div className="mt-0">
          <BreakdownRow label="Gross estate (FMV)" value={grossEstate}
            sub="Financial assets + real estate FMV + business interests + insurance death benefit" />
          <BreakdownRow label="Liabilities" value={totalLiabilities} muted
            sub="Mortgages, loans, and other debts" />
          {trustsExcluded > 0 && (
            <BreakdownRow label="Trusts excluded" value={trustsExcluded} muted />
          )}
          {composition?.admin_expense != null && composition.admin_expense > 0 && (
            <BreakdownRow label="Admin expense (est.)" value={composition.admin_expense} muted
              sub={`${((composition.admin_expense_pct ?? 0.02) * 100).toFixed(0)}% of gross estate — executor fees, legal, accounting`} />
          )}
          {useSyncedGifting ? (
            <>
              {syncedEligibleAnnual > 0 && (
                <BreakdownRow label="Annual exclusion gifts (current year)" value={syncedEligibleAnnual} muted
                  sub="Applied using per-recipient annual exclusion limits" />
              )}
              {syncedLifetimeOverflow > 0 && (
                <BreakdownRow label="Taxable gifts using lifetime exemption" value={syncedLifetimeOverflow} muted
                  sub="Amounts above annual exclusion limits still reduce the estate" />
              )}
            </>
          ) : (
            annualGifting > 0 && (
              <BreakdownRow label="Lifetime gifting reduction" value={annualGifting * giftingYears} muted
                sub={`${formatDollars(annualGifting)}/yr × ${giftingYears} yr`} />
            )
          )}
          {/* Certain/Probable strategy reductions — current or committed transfers */}
          {(composition?.outside_strategy_items ?? [])
            .filter(s => s.confidence_level === 'certain' || s.confidence_level === 'probable')
            .map((item, i) => (
              <BreakdownRow
                key={i}
                label={`− ${item.strategy_source.replace(/_/g, ' ').replace(/\w/g, (c: string) => c.toUpperCase())}`}
                value={item.amount}
                muted
                sub={`${item.confidence_level === 'certain' ? 'Completed transfer' : 'In progress'} — reduces taxable estate`}
              />
            ))
          }

          {/* Illustrative strategies — shown separately, NOT as current deductions */}
          {(composition?.outside_strategy_items ?? []).filter(s => s.confidence_level === 'illustrative').length > 0 && (
            <div className="py-3 border-b border-neutral-100">
              <p className="text-xs font-medium text-neutral-500 mb-1">Illustrative strategies (not yet reducing taxable estate)</p>
              {(composition?.outside_strategy_items ?? [])
                .filter(s => s.confidence_level === 'illustrative')
                .map((item, i) => (
                  <div key={i} className="flex justify-between text-xs text-neutral-400 py-0.5">
                    <span className="italic capitalize">
                      {item.strategy_source.replace(/_/g, ' ').replace(/\w/g, (c: string) => c.toUpperCase())}
                      {item.effective_year ? ` (est. ${item.effective_year})` : ''}
                    </span>
                    <span>{formatDollars(item.amount)} projected</span>
                  </div>
                ))
              }
              <p className="text-[10px] text-neutral-400 mt-1 italic">
                Projected future transfers — assets remain in estate until conditions are met.
              </p>
            </div>
          )}

          {composition?.adjusted_taxable_gifts != null && composition.adjusted_taxable_gifts > 0 && (
            <BreakdownRow label="+ Adjusted taxable gifts" value={composition.adjusted_taxable_gifts}
              sub="Post-1976 taxable gifts added back per IRC §2001(b)" color="text-red-600" />
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pt-4 border-t border-neutral-200">
            <span className="text-base font-semibold text-neutral-900">Taxable estate</span>
            <span className="text-base font-bold text-neutral-900 tabular-nums">
              {federalResult ? formatDollars(federalResult.taxable_estate) : '—'}
            </span>
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Gifting Scenario ── */}
      <CollapsibleSection
        title="Gifting scenario"
        subtitle={
          filing === 'married_joint'
            ? giftingSplitSelected
              ? 'Annual gifting limit: $38,000 with gift-splitting consent on file'
              : 'Annual gifting limit: $19,000 (gift-splitting not selected)'
            : 'Annual gifting limit: $19,000 per donee'
        }
        defaultOpen={false}
        storageKey="estate-tax-gifting-scenario"
      >
        <p className="text-xs text-neutral-500 mb-4">
          Annual gifting reduces the taxable estate. Married couples may elect gift-splitting
          up to $38,000 per donee by filing Form 709 consenting to split gifts.
        </p>

        {giftingAnnualUsed != null && giftingAnnualRemaining != null && (
          <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-700">
            <p className="font-medium text-neutral-800">
              Gifting Strategy sync{giftingTaxYear ? ` (${giftingTaxYear})` : ''}
            </p>
            <p className="mt-1">
              Eligible annual gifts: {formatDollars(giftingAnnualUsed)}.
              {giftingPerRecipientLimit != null && (
                <> Per-recipient limit: {formatDollars(giftingPerRecipientLimit)}
                {giftingSplitSelected ? ' (split-gifting).' : '.'}</>
              )}
            </p>
            {giftingAnnualLoggedTotal != null && (
              <p className="mt-1">Total annual gifts logged: {formatDollars(giftingAnnualLoggedTotal)}.</p>
            )}
            {(giftingExcessOverLimit ?? 0) > 0 && (
              <p className="mt-1 text-amber-700">
                {formatDollars(giftingExcessOverLimit ?? 0)} exceeds the per-recipient annual limit.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Annual gift amount ($)</label>
            <input type="number" min="0" step="1000" value={annualGifting}
              onChange={(e) => setAnnualGifting(Math.max(0, Number(e.target.value) || 0))}
              className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Years of gifting</label>
            <input type="number" min="1" max="40" step="1" value={giftingYears}
              onChange={(e) => setGiftingYears(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
              className={inputClass} />
          </div>
          <div className="flex flex-col justify-end">
            <p className="text-xs text-neutral-500 mb-1">Total gifting reduction</p>
            <p className="text-2xl font-bold text-green-600 tabular-nums">
              {formatDollars(effectiveAnnualGifting * effectiveGiftingYears)}
            </p>
            {federalResult && (
              <p className="text-xs text-neutral-400 mt-0.5">
                Taxable estate: {formatDollars(federalResult.taxable_estate)}
              </p>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── State Estate Tax ── */}
      {(primaryStateTax || compareStateTax || statePrimary) && (
        <CollapsibleSection
          title="State estate tax"
          defaultOpen={false}
          storageKey="estate-tax-state-estate"
        >
          {!statePrimary && (
            <p className="text-sm text-neutral-500">Set your primary state in Profile to see state estate tax.</p>
          )}
          {statePrimary && !STATE_ESTATE_TAX_STATES.has(statePrimary.toUpperCase()) && (
            <p className="text-sm text-neutral-500">
              <span className="font-medium">{statePrimary.toUpperCase()}</span> does not have a state estate tax.
            </p>
          )}

          {(primaryStateTax || compareStateTax) && (
            <div className={`grid gap-6 ${showComparison && compareStateTax ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>

              {/* Primary state */}
              {primaryStateTax && (
                <div>
                  <p className="text-sm font-semibold text-neutral-700 mb-3">
                    {statePrimary.toUpperCase()} — Primary state
                  </p>
                  {isMFJ && hasSpouse && (
                    <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 text-xs text-blue-800">
                      <p className="font-semibold mb-1">First Death — Marital Deduction Applies</p>
                      <p className="leading-relaxed">
                        The estate passes to the surviving spouse tax-free at first death via the
                        unlimited marital deduction. State estate tax at first death = $0.
                      </p>
                      <p className="mt-1.5 leading-relaxed">
                        At second death, {statePrimary.toUpperCase()} applies a{' '}
                        <span className="font-semibold">{formatDollars(primaryStateTax.state_exemption)}</span>{' '}
                        exemption. Without a Credit Shelter Trust, the first spouse's exemption is
                        permanently lost — worth discussing with your estate attorney.
                      </p>
                    </div>
                  )}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">State exemption {isMFJ ? '(at second death)' : ''}</span>
                      <span className="font-medium tabular-nums">{formatDollars(primaryStateTax.state_exemption)}</span>
                    </div>
                    {!isMFJ && (
                      <div className="flex justify-between">
                        <span className="text-neutral-600">State taxable estate</span>
                        <span className="font-medium tabular-nums">{formatDollars(primaryStateTax.state_taxable)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-neutral-100">
                      <span className="font-semibold text-neutral-900">
                        State estate tax {isMFJ ? '(first death)' : ''}
                      </span>
                      <span className={`text-lg font-bold tabular-nums ${primaryStateTax.state_estate_tax > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {isMFJ && hasSpouse ? '$0 — marital deduction' : formatDollars(primaryStateTax.state_estate_tax)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Compare state */}
              {showComparison && compareStateTax && (
                <div className="sm:border-l sm:border-neutral-200 sm:pl-6">
                  <p className="text-sm font-semibold text-neutral-700 mb-3">
                    {stateCompare.toUpperCase()} — Comparison state
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">State exemption</span>
                      <span className="font-medium tabular-nums">{formatDollars(compareStateTax.state_exemption)}</span>
                    </div>
                    {!isMFJ && (
                      <div className="flex justify-between">
                        <span className="text-neutral-600">State taxable estate</span>
                        <span className="font-medium tabular-nums">{formatDollars(compareStateTax.state_taxable)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-neutral-100">
                      <span className="font-semibold text-neutral-900">State estate tax</span>
                      <span className={`text-lg font-bold tabular-nums ${compareStateTax.state_estate_tax > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatDollars(compareStateTax.state_estate_tax)}
                      </span>
                    </div>
                  </div>
                  {primaryStateTax && (
                    <div className="mt-3 rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2 text-xs text-neutral-600">
                      Moving from <span className="font-medium">{statePrimary.toUpperCase()}</span> to{' '}
                      <span className="font-medium">{stateCompare.toUpperCase()}</span> would{' '}
                      {compareStateTax.state_estate_tax < primaryStateTax.state_estate_tax ? (
                        <span className="text-green-700 font-semibold">
                          save {formatDollars(primaryStateTax.state_estate_tax - compareStateTax.state_estate_tax)} in state estate tax
                        </span>
                      ) : compareStateTax.state_estate_tax > primaryStateTax.state_estate_tax ? (
                        <span className="text-red-700 font-semibold">
                          add {formatDollars(compareStateTax.state_estate_tax - primaryStateTax.state_estate_tax)} in state estate tax
                        </span>
                      ) : (
                        <span className="font-medium">result in no state estate tax difference</span>
                      )}.
                    </div>
                  )}
                </div>
              )}

              {showComparison && !compareStateTax && stateCompare && (
                <div className="sm:border-l sm:border-neutral-200 sm:pl-6">
                  <p className="text-sm font-semibold text-neutral-700 mb-3">
                    {stateCompare.toUpperCase()} — Comparison state
                  </p>
                  <p className="text-sm text-neutral-500">
                    {stateCompare.toUpperCase()} does not have a state estate tax.
                  </p>
                </div>
              )}
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* ── State Inheritance Tax ── */}
      {(STATE_INHERITANCE_TAX_STATES.has(statePrimary?.toUpperCase() ?? '') ||
        STATE_INHERITANCE_TAX_STATES.has(stateCompare?.toUpperCase() ?? '')) && (
        <CollapsibleSection
          title="State inheritance tax"
          subtitle="Assessed on the beneficiary's share, not the estate itself"
          defaultOpen={false}
          storageKey="estate-tax-state-inheritance"
        >
          <p className="text-xs text-neutral-500 mb-5">
            Inheritance tax is assessed on the beneficiary's share. Allocate the estate below to see
            estimated tax by beneficiary class.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {(Object.keys(BENEFICIARY_CLASS_LABELS) as BeneficiaryClass[]).map((cls) => (
              <div key={cls}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-neutral-700">{BENEFICIARY_CLASS_LABELS[cls]}</label>
                  <span className="text-xs text-neutral-500 tabular-nums">{inheritShares[cls]}%</span>
                </div>
                <input type="range" min="0" max="100" step="5" value={inheritShares[cls]}
                  onChange={(e) => updateInheritShare(cls, Number(e.target.value))}
                  className="w-full accent-neutral-900" />
              </div>
            ))}
          </div>
          {totalSliderPct !== 100 && (
            <p className="text-xs text-amber-600 mb-4">
              Sliders sum to {totalSliderPct}% — adjust to 100% for accurate results.
            </p>
          )}

          <div className={`grid gap-6 ${showComparison && (primaryInheritanceTax || compareInheritanceTax) ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            {primaryInheritanceTax && (
              <div>
                <p className="text-sm font-semibold text-neutral-700 mb-3">
                  {statePrimary.toUpperCase()} — Inheritance tax
                </p>
                <div className="space-y-1">
                  {primaryInheritanceTax.results.filter(r => r.share_amount > 0).map(r => (
                    <div key={r.beneficiary_class} className="flex justify-between text-sm py-1 border-b border-neutral-100">
                      <span className="text-neutral-600">{BENEFICIARY_CLASS_LABELS[r.beneficiary_class as BeneficiaryClass]}</span>
                      <span className={`font-medium tabular-nums ${r.inheritance_tax > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatDollars(r.inheritance_tax)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-neutral-200">
                    <span className="font-semibold text-neutral-900 text-sm">Total inheritance tax</span>
                    <span className={`text-lg font-bold tabular-nums ${primaryInheritanceTax.total_inheritance_tax > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatDollars(primaryInheritanceTax.total_inheritance_tax)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {compareInheritanceTax && (
              <div className="sm:border-l sm:border-neutral-200 sm:pl-6">
                <p className="text-sm font-semibold text-neutral-700 mb-3">
                  {stateCompare.toUpperCase()} — Inheritance tax
                </p>
                <div className="space-y-1">
                  {compareInheritanceTax.results.filter(r => r.share_amount > 0).map(r => (
                    <div key={r.beneficiary_class} className="flex justify-between text-sm py-1 border-b border-neutral-100">
                      <span className="text-neutral-600">{BENEFICIARY_CLASS_LABELS[r.beneficiary_class as BeneficiaryClass]}</span>
                      <span className={`font-medium tabular-nums ${r.inheritance_tax > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatDollars(r.inheritance_tax)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-neutral-200">
                    <span className="font-semibold text-neutral-900 text-sm">Total inheritance tax</span>
                    <span className={`text-lg font-bold tabular-nums ${compareInheritanceTax.total_inheritance_tax > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatDollars(compareInheritanceTax.total_inheritance_tax)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      <p className="text-xs text-neutral-400 mt-6">
        Illustrative only — not tax or legal advice. Consult a qualified estate planning attorney.{' '}
        <Link href="/trust-will" className="text-indigo-600 hover:underline">Manage trusts →</Link>
      </p>

      {showTrustModal && (
        <TrustModal
          editRow={editTrust}
          inputClass={inputClass}
          onClose={() => { setShowTrustModal(false); setEditTrust(null) }}
          onSaved={async () => {
            setShowTrustModal(false)
            setEditTrust(null)
            await loadTrusts()
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Trust modal (unchanged from prior version)
// ─────────────────────────────────────────────────────────────

function TrustModal({
  editRow,
  inputClass: ic,
  onClose,
  onSaved,
}: {
  editRow: EstateTaxTrustRow | null
  inputClass: string
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [name, setName] = useState(editRow?.name ?? '')
  const [trustType, setTrustType] = useState(editRow?.trust_type ?? 'revocable')
  const [grantor, setGrantor] = useState(editRow?.grantor ?? '')
  const [trustee, setTrustee] = useState(editRow?.trustee ?? '')
  const [fundingAmount, setFundingAmount] = useState(
    editRow != null ? String(num(editRow.funding_amount ?? editRow.excluded_from_estate)) : '0',
  )
  const [state, setState] = useState(editRow?.state ?? '')
  const [isIrrevocable, setIsIrrevocable] = useState(editRow?.is_irrevocable ?? false)
  const [excludesFromEstate, setExcludesFromEstate] = useState(
    editRow?.excludes_from_estate ?? (editRow != null && num(editRow.excluded_from_estate) > 0),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function localNum(v: unknown): number {
    if (typeof v === 'number' && !Number.isNaN(v)) return v
    if (typeof v === 'string' && v !== '') return Number(v) || 0
    return 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const funding = Math.max(0, parseFloat(fundingAmount) || 0)
      const excludedNumeric = excludesFromEstate ? funding : 0
      const payload = {
        name: name.trim() || 'Trust',
        trust_type: trustType,
        grantor: grantor.trim(),
        trustee: trustee.trim(),
        funding_amount: funding,
        state: state.trim().length === 2 ? state.trim().toUpperCase() : state.trim(),
        is_irrevocable: isIrrevocable,
        excludes_from_estate: excludesFromEstate,
        excluded_from_estate: excludedNumeric,
        updated_at: new Date().toISOString(),
      }
      if (editRow) {
        const { error } = await supabase.from('trusts').update(payload).eq('id', editRow.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('trusts').insert({
          ...payload,
          owner_id: (await supabase.auth.getUser()).data.user?.id,
        })
        if (error) throw error
      }
      await onSaved()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200">
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="text-base font-semibold text-neutral-900">
            {editRow ? 'Edit Trust' : 'Add Trust'}
          </h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{formError}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={ic} placeholder="e.g. Smith Family Trust" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Trust type</label>
            <select value={trustType} onChange={(e) => setTrustType(e.target.value)} className={ic}>
              {TRUST_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Grantor</label>
              <input type="text" value={grantor} onChange={(e) => setGrantor(e.target.value)} className={ic} placeholder="Name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Trustee</label>
              <input type="text" value={trustee} onChange={(e) => setTrustee(e.target.value)} className={ic} placeholder="Name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Funding amount ($)</label>
              <input type="number" min="0" step="0.01" value={fundingAmount} onChange={(e) => setFundingAmount(e.target.value)} className={ic} />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">State</label>
              <input type="text" value={state} onChange={(e) => setState(e.target.value)} className={ic} placeholder="e.g. CA" maxLength={32} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input id="isIrrevocable" type="checkbox" checked={isIrrevocable} onChange={(e) => setIsIrrevocable(e.target.checked)} className="h-4 w-4 rounded border-neutral-300" />
            <label htmlFor="isIrrevocable" className="text-sm text-neutral-700">Is irrevocable</label>
          </div>
          <div className="flex items-center gap-2">
            <input id="excludesFromEstate" type="checkbox" checked={excludesFromEstate} onChange={(e) => setExcludesFromEstate(e.target.checked)} className="h-4 w-4 rounded border-neutral-300" />
            <label htmlFor="excludesFromEstate" className="text-sm text-neutral-700">Excludes from estate</label>
          </div>
          <div className="flex gap-3 pt-2 pb-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition">
              {isSubmitting ? 'Saving...' : editRow ? 'Save Changes' : 'Add Trust'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
