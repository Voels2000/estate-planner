'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  calcSection121Exclusion,
  computeFederalEstateTax,
  computeStateEstateTax,
  computeStateInheritanceTaxTotal,
  type BeneficiaryClass,
  type EstateTaxBracket,
  type StateEstateTaxBracket,
  type StateInheritanceTaxRule,
} from '@/lib/calculations/estate-tax'
import { CollapsibleSection } from '@/components/CollapsibleSection'

const inputClass =
  'block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500'

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
      <p
        className={`mt-1 text-xl font-bold ${
          highlight === 'green'
            ? 'text-green-600'
            : highlight === 'red'
              ? 'text-red-600'
              : highlight === 'amber'
                ? 'text-amber-600'
                : 'text-neutral-900'
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
    </div>
  )
}

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

// ─────────────────────────────────────────────────────────────
// States that have estate tax (for display label)
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type EstateTaxRealEstateRow = {
  id?: string
  current_value?: unknown
  purchase_price?: unknown | null
  is_primary_residence?: boolean
  years_lived_in?: unknown | null
}

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
  { value: 'revocable', label: 'Revocable' },
  { value: 'irrevocable', label: 'Irrevocable' },
  { value: 'qtip', label: 'QTIP' },
  { value: 'bypass', label: 'Bypass' },
  { value: 'charitable', label: 'Charitable' },
  { value: 'special_needs', label: 'Special needs' },
] as const

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export default function EstateTaxClient({
  assets,
  liabilities,
  realEstate,
  trusts: initialTrusts,
  household,
  brackets: bracketRows,
  stateEstateTaxRules: stateEstateTaxRows,
  stateInheritanceTaxRules: stateInheritanceTaxRuleRows,
  primaryResidenceValue,
  liveNetWorth,
  giftingAnnualCapacity,
  giftingAnnualUsed,
  giftingAnnualRemaining,
  giftingAnnualLoggedTotal,
  giftingTaxYear,
  giftingSplitSelected,
  giftingPerRecipientLimit,
  giftingExcessOverLimit,
}: {
  assets: Record<string, unknown>[]
  liabilities: Record<string, unknown>[]
  realEstate: EstateTaxRealEstateRow[]
  trusts: EstateTaxTrustRow[]
  household: Record<string, unknown> | null
  brackets: Record<string, unknown>[]
  stateEstateTaxRules: Record<string, unknown>[]
  stateInheritanceTaxRules: Record<string, unknown>[]
  /** Sum of FMV for `real_estate.is_primary_residence`; omit UI when null */
  primaryResidenceValue: number | null
  liveNetWorth?: number
  giftingAnnualCapacity?: number | null
  giftingAnnualUsed?: number | null
  giftingAnnualRemaining?: number | null
  giftingAnnualLoggedTotal?: number | null
  giftingTaxYear?: number | null
  giftingSplitSelected?: boolean
  giftingPerRecipientLimit?: number | null
  giftingExcessOverLimit?: number | null
}) {
  const router = useRouter()
  const [trusts, setTrusts] = useState<EstateTaxTrustRow[]>(initialTrusts)
  useEffect(() => { setTrusts(initialTrusts) }, [initialTrusts])

  const [showTrustModal, setShowTrustModal] = useState(false)
  const [editTrust, setEditTrust] = useState<EstateTaxTrustRow | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  // ── Core asset calculations ─────────────────────────────────
  const financialAssets = useMemo(
    () => assets.reduce((s, a) => s + num(a.value), 0),
    [assets],
  )

  const { realEstateIncluded, section121Total, realEstateFmv } = useMemo(() => {
    let included = 0
    let fmv = 0
    let s121 = 0
    for (const r of realEstate) {
      const value = num(r.current_value)
      fmv += value
      const purchase = r.purchase_price != null ? num(r.purchase_price) : value
      const gain = Math.max(0, value - purchase)
      const excl = calcSection121Exclusion(
        Boolean(r.is_primary_residence),
        num(r.years_lived_in ?? 0),
        filing,
        gain,
      )
      s121 += excl
      included += value - excl
    }
    return { realEstateIncluded: included, section121Total: s121, realEstateFmv: fmv }
  }, [realEstate, filing])

  const totalLiabilities = useMemo(
    () => liabilities.reduce((s, l) => s + num(l.balance), 0),
    [liabilities],
  )

  const trustsExcluded = useMemo(() => trustsExcludedSum(trusts), [trusts])
  const grossEstate = liveNetWorth ?? (financialAssets + realEstateIncluded)
  const grossEstateForState = financialAssets + realEstateFmv

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

  // ── Federal result (includes gifting) ───────────────────────
  const federalResult =
    brackets.length > 0
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

  // ── State estate tax rules ───────────────────────────────────
  const stateEstateBrackets: StateEstateTaxBracket[] = useMemo(() => {
    const latestYear = Math.max(...stateEstateTaxRows.map(r => num(r.tax_year)), 0)
    return stateEstateTaxRows
      .filter(r => num(r.tax_year) === latestYear)
      .map((r) => ({
        state: String(r.state ?? '').trim().toUpperCase(),
        min_amount: num(r.min_amount),
        max_amount: num(r.max_amount),
        rate_pct: num(r.rate_pct),
        exemption_amount: num(r.exemption_amount),
      }))
  }, [stateEstateTaxRows])

  // ── State inheritance tax rules ──────────────────────────────
  const stateInheritanceRules: StateInheritanceTaxRule[] = useMemo(() => {
    const latestYear = Math.max(...stateInheritanceTaxRuleRows.map(r => num(r.tax_year)), 0)
    return stateInheritanceTaxRuleRows
      .filter(r => num(r.tax_year) === latestYear)
      .map((r) => ({
        state: String(r.state ?? '').trim().toUpperCase(),
        beneficiary_class: String(r.beneficiary_class ?? ''),
        min_amount: num(r.min_amount),
        max_amount: num(r.max_amount),
        rate_pct: num(r.rate_pct),
        exemption_amount: num(r.exemption_amount),
      }))
  }, [stateInheritanceTaxRuleRows])

  // ── State estate tax results ─────────────────────────────────
  const isMFJ = filing === 'married_joint'
  const taxableForStateMD = isMFJ ? grossEstateForState * 0.5 : grossEstateForState
  const primaryStateTax = useMemo(() => {
    if (!statePrimary || !STATE_ESTATE_TAX_STATES.has(statePrimary.toUpperCase())) return null
    if (isMFJ) {
      // Married: no state estate tax at first death via marital deduction
      return {
        state: statePrimary.toUpperCase(),
        state_taxable: 0,
        state_exemption:
          stateEstateBrackets.find(b => b.state === statePrimary.toUpperCase())?.exemption_amount ?? 0,
        state_estate_tax: 0,
      }
    }
    return computeStateEstateTax(
      statePrimary.toUpperCase(),
      num(federalResult?.taxable_estate),
      stateEstateBrackets,
    )
  }, [statePrimary, isMFJ, federalResult, stateEstateBrackets])

  const compareStateTax = useMemo(() => {
    const sc = stateCompare?.toUpperCase()
    if (!sc || sc === statePrimary?.toUpperCase()) return null
    if (!STATE_ESTATE_TAX_STATES.has(sc)) return null
    if (isMFJ) {
      return {
        state: sc,
        state_taxable: 0,
        state_exemption: stateEstateBrackets.find(b => b.state === sc)?.exemption_amount ?? 0,
        state_estate_tax: 0,
      }
    }
    return computeStateEstateTax(sc, num(federalResult?.taxable_estate), stateEstateBrackets)
  }, [stateCompare, statePrimary, isMFJ, federalResult, stateEstateBrackets])

  // ── State inheritance tax results ────────────────────────────
  const totalForInheritance = taxableForStateMD // was taxableForState
  const inheritanceShareDollars = useMemo<Partial<Record<BeneficiaryClass, number>>>(() => {
    const total = inheritShares.spouse + inheritShares.child + inheritShares.sibling + inheritShares.other
    if (total === 0) return {}
    return {
      spouse: (inheritShares.spouse / total) * totalForInheritance,
      child: (inheritShares.child / total) * totalForInheritance,
      sibling: (inheritShares.sibling / total) * totalForInheritance,
      other: (inheritShares.other / total) * totalForInheritance,
    }
  }, [inheritShares, totalForInheritance])

  const primaryInheritanceTax = useMemo(() => {
    if (!statePrimary || !STATE_INHERITANCE_TAX_STATES.has(statePrimary.toUpperCase())) return null
    return computeStateInheritanceTaxTotal(
      statePrimary.toUpperCase(),
      inheritanceShareDollars,
      stateInheritanceRules,
    )
  }, [statePrimary, inheritanceShareDollars, stateInheritanceRules])

  const compareInheritanceTax = useMemo(() => {
    const sc = stateCompare?.toUpperCase()
    if (!sc || sc === statePrimary?.toUpperCase()) return null
    if (!STATE_INHERITANCE_TAX_STATES.has(sc)) return null
    return computeStateInheritanceTaxTotal(sc, inheritanceShareDollars, stateInheritanceRules)
  }, [stateCompare, statePrimary, inheritanceShareDollars, stateInheritanceRules])

  // ── Show comparison column? ──────────────────────────────────
  const showComparison =
    !!stateCompare &&
    stateCompare.toUpperCase() !== statePrimary?.toUpperCase() &&
    (compareStateTax !== null || compareInheritanceTax !== null)

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

  function openAddTrust() { setEditTrust(null); setShowTrustModal(true); setError(null) }
  function openEditTrust(t: EstateTaxTrustRow) { setEditTrust(t); setShowTrustModal(true); setError(null) }

  // ── Shared breakdown row ─────────────────────────────────────
  function breakdownRow(label: string, value: number, opts?: { muted?: boolean; sub?: string }) {
    return (
      <div
        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-3 border-b border-neutral-100 last:border-0 ${
          opts?.muted ? 'text-neutral-500' : ''
        }`}
      >
        <div>
          <span className={opts?.muted ? 'text-sm' : 'text-sm font-medium text-neutral-800'}>
            {label}
          </span>
          {opts?.sub && <p className="text-xs text-neutral-400 mt-0.5">{opts.sub}</p>}
        </div>
        <span className={`text-sm font-semibold tabular-nums ${opts?.muted ? '' : 'text-neutral-900'}`}>
          {opts?.muted && value >= 0 ? '−' : ''}
          {formatDollars(Math.abs(value))}
        </span>
      </div>
    )
  }

  // ── Slider helper ────────────────────────────────────────────
  function updateInheritShare(cls: BeneficiaryClass, pct: number) {
    setInheritShares((prev) => ({ ...prev, [cls]: Math.max(0, Math.min(100, pct)) }))
  }

  const totalSliderPct =
    inheritShares.spouse + inheritShares.child + inheritShares.sibling + inheritShares.other

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">

      {/* ── Header ── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Estate Tax</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Federal + state estate tax picture (illustrative only—not tax advice).
        </p>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <CollapsibleSection
        title="Federal estate summary"
        subtitle="Gross estate, taxable estate, exemption, and federal tax"
        defaultOpen={true}
        storageKey="estate-tax-federal-summary"
      >
      {primaryResidenceValue != null && primaryResidenceValue > 0 && (
        <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-4 text-sm text-neutral-700">
          <p className="font-semibold text-neutral-900">
            ℹ️ Primary Residence &amp; Married Couples
          </p>
          <p className="mt-2 leading-relaxed">
            Your primary residence (est. {formatDollars(primaryResidenceValue)}) is excluded from this
            first-death estimate. For married couples, the residence typically passes to the surviving
            spouse tax-free at first death via the marital deduction.
          </p>
          <p className="mt-2 leading-relaxed">
            At second death, the residence is fully included in the surviving spouse&apos;s taxable
            estate — which can significantly increase tax exposure. Your estate attorney can help
            structure ownership to minimize this impact.
          </p>
        </div>
      )}

      {/* ── Federal summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <SummaryCard
          label="Gross Estate"
          value={formatDollars(grossEstate)}
          sub="Financial assets + real estate (§121-adjusted)"
        />
        <SummaryCard
          label="Taxable Estate"
          value={federalResult ? formatDollars(federalResult.taxable_estate) : '—'}
          sub="After liabilities, trusts & gifting"
        />
        <SummaryCard
          label="Federal Exemption Used"
          value={federalResult ? formatDollars(federalResult.exemption_used) : '—'}
          sub="Sheltered amount (reporting)"
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

      {!federalResult && (
        <p className="mb-0 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          No valid rows in <code className="text-xs">federal_estate_tax_brackets</code>. Add brackets to
          compute tax.
        </p>
      )}
      </CollapsibleSection>

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
          Annual gifting reduces the taxable estate used for both federal and state calculations.
          Annual exclusion is {formatDollars(19000)} per donor. Married couples can treat gifts as
          split gifts up to {formatDollars(38000)} per donee only if both spouses are U.S.
          citizens/residents, remain married for the year, and timely file Form 709 consenting to
          gift-splitting.
        </p>
        {giftingAnnualCapacity != null &&
          giftingAnnualUsed != null &&
          giftingAnnualRemaining != null && (
            <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-700">
              <p className="font-medium text-neutral-800">
                Gifting Strategy sync{giftingTaxYear ? ` (${giftingTaxYear})` : ''}
              </p>
              <p className="mt-1">
                Eligible annual gifts applied to estate-tax reduction: {formatDollars(giftingAnnualUsed)}.
                {giftingPerRecipientLimit != null && (
                  <>
                    {' '}Per-recipient limit used: {formatDollars(giftingPerRecipientLimit)}
                    {giftingSplitSelected ? ' (gift-splitting selected).' : ' (gift-splitting not selected).'}
                  </>
                )}
              </p>
              {giftingAnnualLoggedTotal != null && (
                <p className="mt-1">
                  Total annual gifts logged: {formatDollars(giftingAnnualLoggedTotal)}.
                </p>
              )}
              {(giftingExcessOverLimit ?? 0) > 0 && (
                <p className="mt-1 text-amber-700">
                  {formatDollars(giftingExcessOverLimit ?? 0)} exceeds the per-recipient annual limit and is
                  not included in the annual exclusion reduction.
                </p>
              )}
              {filing === 'married_joint' && !giftingSplitSelected && (
                <p className="mt-1 text-amber-700">
                  Gift-splitting was not selected in Gifting Strategy, so this page uses the{' '}
                  {formatDollars(19000)} limit.
                </p>
              )}
            </div>
          )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Annual gift amount ($)
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              value={annualGifting}
              onChange={(e) => setAnnualGifting(Math.max(0, Number(e.target.value) || 0))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Years of gifting
            </label>
            <input
              type="number"
              min="1"
              max="40"
              step="1"
              value={giftingYears}
              onChange={(e) =>
                setGiftingYears(Math.max(1, Math.min(40, Number(e.target.value) || 1)))
              }
              className={inputClass}
            />
          </div>
          <div className="flex flex-col justify-end">
            <p className="text-xs text-neutral-500 mb-1">Total gifting reduction</p>
            <p className="text-2xl font-bold text-green-600 tabular-nums">
              {formatDollars(effectiveAnnualGifting * effectiveGiftingYears)}
            </p>
            {federalResult && (
              <p className="text-xs text-neutral-400 mt-0.5">
                Taxable estate reduced to {formatDollars(federalResult.taxable_estate)}
              </p>
            )}
            {useSyncedGifting && (
              <p className="text-xs text-neutral-500 mt-1">
                Synced from Gifting Strategy (current tax year): eligible annual + lifetime-overflow taxable gifts.
              </p>
            )}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Federal estate breakdown"
        defaultOpen={false}
        storageKey="estate-tax-federal-breakdown"
      >
        <div className="mt-0">
          {breakdownRow('Financial assets', financialAssets)}
          {breakdownRow(
            'Real estate',
            realEstateIncluded,
            section121Total > 0
              ? {
                  sub: `FMV ${formatDollars(realEstateFmv)} less §121 exclusion ${formatDollars(section121Total)} on qualifying primary residence gain`,
                }
              : realEstate.length > 0
                ? { sub: 'Included at current value (no §121 reduction)' }
                : undefined,
          )}
          {breakdownRow('Liabilities', totalLiabilities, { muted: true })}
          {breakdownRow('Trusts excluded', trustsExcluded, { muted: true })}
          {useSyncedGifting ? (
            <>
              {syncedEligibleAnnual > 0 &&
                breakdownRow(
                  'Annual exclusion gifts (current year)',
                  syncedEligibleAnnual,
                  {
                    muted: true,
                    sub: 'Applied using per-recipient annual exclusion limits',
                  },
                )}
              {syncedLifetimeOverflow > 0 &&
                breakdownRow(
                  'Taxable gifts using lifetime exemption',
                  syncedLifetimeOverflow,
                  {
                    muted: true,
                    sub: 'Amounts above annual exclusion limits still reduce the estate',
                  },
                )}
            </>
          ) : (
            annualGifting > 0 &&
            breakdownRow(
              'Lifetime gifting reduction',
              annualGifting * giftingYears,
              {
                muted: true,
                sub: `${formatDollars(annualGifting)}/yr × ${giftingYears} yr`,
              },
            )
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pt-4 border-t border-neutral-200">
            <span className="text-base font-semibold text-neutral-900">Taxable estate</span>
            <span className="text-base font-bold text-neutral-900 tabular-nums">
              {federalResult ? formatDollars(federalResult.taxable_estate) : '—'}
            </span>
          </div>
        </div>
      </CollapsibleSection>

      {(primaryStateTax || compareStateTax || statePrimary) && (
        <CollapsibleSection
          title="State estate tax"
          defaultOpen={false}
          storageKey="estate-tax-state-estate"
        >
          {!statePrimary && (
            <p className="text-sm text-neutral-500">
              Set your primary state in Profile to see state estate tax.
            </p>
          )}

          {statePrimary && !STATE_ESTATE_TAX_STATES.has(statePrimary.toUpperCase()) && (
            <p className="text-sm text-neutral-500">
              <span className="font-medium">{statePrimary.toUpperCase()}</span> does not have a state
              estate tax.
            </p>
          )}

          {(primaryStateTax || compareStateTax) && (
            <div className={`grid gap-6 ${showComparison ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              {/* Primary state */}
              {primaryStateTax && (
                <div>
                  <p className="text-sm font-semibold text-neutral-700 mb-3">
                    {statePrimary.toUpperCase()} — Primary state
                  </p>
                  {isMFJ && (
                    <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 text-xs text-blue-800">
                      <p className="font-semibold mb-1">First Death — Marital Deduction Applies</p>
                      <p className="leading-relaxed">
                        For married couples, the entire estate passes to the surviving spouse
                        tax-free at first death via the unlimited marital deduction.
                        State estate tax at first death = $0.
                      </p>
                      <p className="mt-1.5 leading-relaxed">
                        At the second death, {statePrimary.toUpperCase()} applies a{' '}
                        <span className="font-semibold">{formatDollars(primaryStateTax.state_exemption)}</span>{' '}
                        exemption against the combined estate. Without advance planning, the first
                        spouse&apos;s {formatDollars(primaryStateTax.state_exemption)} exemption is
                        permanently lost — only one exemption applies at second death.
                      </p>
                      <p className="mt-1.5 leading-relaxed">
                        A Credit Shelter Trust (Bypass Trust) funded at first death can preserve
                        both spouses&apos; exemptions, potentially reducing{' '}
                        {statePrimary.toUpperCase()} estate tax by{' '}
                        <span className="font-semibold">
                          {formatDollars(primaryStateTax.state_exemption * 0.10)}–{formatDollars(primaryStateTax.state_exemption * 0.20)}
                        </span>{' '}
                        or more depending on the estate size and growth. This is worth discussing
                        with your estate attorney before the first death occurs.
                      </p>
                    </div>
                  )}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">State exemption {isMFJ ? '(at second death)' : ''}</span>
                      <span className="font-medium tabular-nums">
                        {formatDollars(primaryStateTax.state_exemption)}
                      </span>
                    </div>
                    {!isMFJ && (
                      <div className="flex justify-between">
                        <span className="text-neutral-600">State taxable estate</span>
                        <span className="font-medium tabular-nums">
                          {formatDollars(primaryStateTax.state_taxable)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-neutral-100">
                      <span className="font-semibold text-neutral-900">
                        State estate tax {isMFJ ? '(first death)' : ''}
                      </span>
                      <span
                        className={`text-lg font-bold tabular-nums ${
                          primaryStateTax.state_estate_tax > 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {isMFJ ? '$0 — marital deduction' : formatDollars(primaryStateTax.state_estate_tax)}
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
                      <span className="font-medium tabular-nums">
                        {formatDollars(compareStateTax.state_exemption)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">State taxable estate</span>
                      <span className="font-medium tabular-nums">
                        {formatDollars(compareStateTax.state_taxable)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-neutral-100">
                      <span className="font-semibold text-neutral-900">State estate tax</span>
                      <span
                        className={`text-lg font-bold tabular-nums ${
                          compareStateTax.state_estate_tax > 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {formatDollars(compareStateTax.state_estate_tax)}
                      </span>
                    </div>
                  </div>
                  {primaryStateTax && (
                    <div className="mt-3 rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2 text-xs text-neutral-600">
                      Moving from{' '}
                      <span className="font-medium">{statePrimary.toUpperCase()}</span> to{' '}
                      <span className="font-medium">{stateCompare.toUpperCase()}</span> would{' '}
                      {compareStateTax.state_estate_tax < primaryStateTax.state_estate_tax ? (
                        <span className="text-green-700 font-semibold">
                          save {formatDollars(primaryStateTax.state_estate_tax - compareStateTax.state_estate_tax)}{' '}
                          in state estate tax
                        </span>
                      ) : compareStateTax.state_estate_tax > primaryStateTax.state_estate_tax ? (
                        <span className="text-red-700 font-semibold">
                          add {formatDollars(compareStateTax.state_estate_tax - primaryStateTax.state_estate_tax)}{' '}
                          in state estate tax
                        </span>
                      ) : (
                        <span className="font-medium">result in no state estate tax difference</span>
                      )}
                      .
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

      {(STATE_INHERITANCE_TAX_STATES.has(statePrimary?.toUpperCase() ?? '') ||
        STATE_INHERITANCE_TAX_STATES.has(stateCompare?.toUpperCase() ?? '')) && (
        <CollapsibleSection
          title="State inheritance tax"
          subtitle="Inheritance tax is assessed on the beneficiary's share, not the estate itself"
          defaultOpen={false}
          storageKey="estate-tax-state-inheritance"
        >
          <p className="text-xs text-neutral-500 mb-5">
            Inheritance tax is assessed on the beneficiary's share, not the estate itself. Allocate
            the estate below to see estimated tax by class.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {(Object.keys(BENEFICIARY_CLASS_LABELS) as BeneficiaryClass[]).map((cls) => (
              <div key={cls}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-neutral-700">
                    {BENEFICIARY_CLASS_LABELS[cls]}
                  </label>
                  <span className="text-xs text-neutral-500 tabular-nums">
                    {inheritShares[cls]}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={inheritShares[cls]}
                  onChange={(e) => updateInheritShare(cls, Number(e.target.value))}
                  className="w-full accent-neutral-900"
                />
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
                  {primaryInheritanceTax.results
                    .filter((r) => r.share_amount > 0)
                    .map((r) => (
                      <div key={r.beneficiary_class} className="flex justify-between text-sm py-1 border-b border-neutral-100">
                        <span className="text-neutral-600">
                          {BENEFICIARY_CLASS_LABELS[r.beneficiary_class as BeneficiaryClass]}
                        </span>
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
                  {compareInheritanceTax.results
                    .filter((r) => r.share_amount > 0)
                    .map((r) => (
                      <div key={r.beneficiary_class} className="flex justify-between text-sm py-1 border-b border-neutral-100">
                        <span className="text-neutral-600">
                          {BENEFICIARY_CLASS_LABELS[r.beneficiary_class as BeneficiaryClass]}
                        </span>
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

      {/* Trusts section moved to Trust & Will page */}

      <p className="text-xs text-neutral-400">
        Consult a qualified professional for estate planning and tax compliance.{' '}
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
// Trust modal
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
    editRow != null
      ? String(num(editRow.funding_amount ?? editRow.excluded_from_estate))
      : '0',
  )
  const [state, setState] = useState(editRow?.state ?? '')
  const [isIrrevocable, setIsIrrevocable] = useState(editRow?.is_irrevocable ?? false)
  const [excludesFromEstate, setExcludesFromEstate] = useState(
    editRow?.excludes_from_estate ??
      (editRow != null && num(editRow.excluded_from_estate) > 0),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function num(v: unknown): number {
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
        const { error } = await supabase.from('trusts').insert({ ...payload, owner_id: (await supabase.auth.getUser()).data.user?.id })
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
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {formError}
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={ic} placeholder="e.g. Smith Family Trust" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Trust type</label>
            <select value={trustType} onChange={(e) => setTrustType(e.target.value)} className={ic}>
              {TRUST_TYPES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
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