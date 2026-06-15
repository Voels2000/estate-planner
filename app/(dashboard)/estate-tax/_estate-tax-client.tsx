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

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  computeFederalEstateTax,
  computeStateInheritanceTaxTotal,
  type BeneficiaryClass,
  type EstateTaxBracket,
  type StateInheritanceTaxRule,
} from '@/lib/calculations/estate-tax'
import {
  resolveStateTaxForDeathPhase,
} from '@/lib/calculations/stateEstateTax'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import type { EstateComposition } from '@/lib/estate/types'
import {
  FEDERAL_EXEMPTION_AFTER_GIFTS_LABEL,
  HEADROOM_BEFORE_FEDERAL_TAX_LABEL,
} from '@/lib/estate/exemptionLabels'
import { DISCLAIMER_STRINGS } from '@/lib/compliance/language-policy'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { taxTermExplainer, type TaxTermContext } from '@/lib/estate/taxTermExplainers'
import { annualGiftingCapacity } from '@/lib/gifting/perRecipientLimit'
import { getStateDisplayName, isMFJFilingStatus } from '@/lib/calculations/stateEstateTax'
import { STATE_SLUG_MAP, stateCodeToSlug } from '@/lib/learn/state-estate-tax-slugs'
import { isWaState } from '@/lib/estate/waRegime'
import {
  WA_ESTATE_TAX_CONSUMER_DETAIL,
  WA_ESTATE_TAX_CONSUMER_SUMMARY,
} from '@/lib/estate/waDisclaimers'

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

const WA_NO_PORTABILITY_STATES = new Set(['WA', 'MA', 'OR'])

export type EstateTaxStrategyLineItem = {
  id: string
  strategy_type: string
  strategy_label?: string
  estimated_exclusion?: number
}

function getStrategyDescription(strategyType: string, state: string | null): string {
  const descriptions: Record<string, string> = {
    bypass_trust: `Preserves ${state ?? 'state'} exemption at first death · no portability loss`,
    cst: `Preserves ${state ?? 'state'} exemption at first death · no portability loss`,
    credit_shelter_trust: `Preserves ${state ?? 'state'} exemption at first death · no portability loss`,
    ilit: 'Removes life insurance death benefit from gross estate',
    annual_gifting: 'Annual exclusion gifts reduce taxable estate over time',
    gifting: 'Annual exclusion gifts reduce taxable estate over time',
    slat: 'Spousal Lifetime Access Trust — removes assets while retaining indirect access',
    grat: 'Grantor Retained Annuity Trust — transfers appreciation out of estate',
    charitable: 'Charitable remainder trust — reduces estate while generating income',
  }
  return descriptions[strategyType] ?? strategyType.replace(/_/g, ' ')
}

// ─────────────────────────────────────────────────────────────
// Presentational helpers
// ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  highlight,
  labelTooltip,
}: {
  label: string
  value: string
  sub?: string
  highlight?: 'green' | 'red' | 'amber'
  labelTooltip?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {labelTooltip ? (
          <span className="flex items-center gap-1">
            {label}
            {labelTooltip}
          </span>
        ) : (
          label
        )}
      </p>
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
  giftingExcessOverLimit,
  // Pre-fetched from page.tsx via classifyEstateAssets
  composition: compositionProp,
  strategyLineItems,
  noPortability = false,
  waThresholdToday = null,
  mcUpdating = false,
}: {
  liabilities: Record<string, unknown>[]
  trusts: EstateTaxTrustRow[]
  household: Record<string, unknown> | null
  brackets: Record<string, unknown>[]
  stateEstateTaxRules: Record<string, unknown>[]
  stateInheritanceTaxRules: Record<string, unknown>[]
  giftingAnnualCapacity?: number | null
  giftingAnnualUsed?: number | null
  giftingAnnualRemaining?: number | null
  giftingAnnualLoggedTotal?: number | null
  giftingTaxYear?: number | null
  giftingSplitSelected?: boolean
  giftingPerRecipientLimit?: number | null
  giftingExcessOverLimit?: number | null
  composition?: EstateComposition | null
  strategyLineItems?: EstateTaxStrategyLineItem[] | null
  noPortability?: boolean
  waThresholdToday?: {
    year: number
    age_p1: number
    pct_above_threshold: number
  } | null
  mcUpdating?: boolean
}) {
  // Composition state — use prop if available, else fetch client-side
  const [composition, setComposition] = useState<EstateComposition | null>(compositionProp ?? null)
  const [compositionLoading, setCompositionLoading] = useState(!compositionProp)

  useEffect(() => {
    if (compositionProp) return
    // Fallback: fetch client-side if page didn't pass it as a prop
    const householdId = household?.id as string | null
    if (!householdId) return
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

  // ── Inheritance tax: beneficiary allocation sliders ──────────
  const [inheritShares, setInheritShares] = useState<Record<BeneficiaryClass, number>>({
    spouse: 50,
    child: 50,
    sibling: 0,
    other: 0,
  })

  const filing = filingForTax(household)
  const syncedEligibleAnnual = Math.max(0, giftingAnnualUsed ?? 0)
  const syncedLifetimeOverflow = Math.max(0, giftingExcessOverLimit ?? 0)
  const syncedGiftTotalReduction = syncedEligibleAnnual + syncedLifetimeOverflow
  const effectiveAnnualGifting = syncedGiftTotalReduction
  const effectiveGiftingYears = syncedGiftTotalReduction > 0 ? 1 : 0

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
  const trustsExcluded = useMemo(() => trustsExcludedSum(initialTrusts), [initialTrusts])

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

  // Keep federal summary display in sync with "Your Estate" snapshot source.
  const grossEstateDisplay = composition?.gross_estate ?? grossEstate
  const taxableEstateDisplay = composition?.taxable_estate ?? federalResult?.taxable_estate ?? 0
  const federalExemptionDisplay = composition?.exemption_available ?? federalResult?.exemption_used ?? 0
  const federalTaxDisplay = composition?.estimated_tax_federal ?? composition?.estimated_tax ?? federalResult?.net_estate_tax ?? 0


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
  // calculateStateEstateTax uses the bracket exemption amount directly.
  const isMFJ = filing === 'married_joint'
  const hasSpouse = household?.has_spouse === true

  const primaryStateBrackets = useMemo(() => {
    const latestYear = Math.max(...stateEstateTaxRows.map(r => num(r.tax_year)), 0)
    return stateEstateTaxRows
      .filter(r => num(r.tax_year) === latestYear && String(r.state ?? '').trim().toUpperCase() === statePrimary?.toUpperCase())
      .map((r) => ({
        min_amount:       num(r.min_amount),
        max_amount:       num(r.max_amount),
        rate_pct:         num(r.rate_pct),
        exemption_amount: num(r.exemption_amount),
      }))
  }, [stateEstateTaxRows, statePrimary])

  const primaryStateExemption = primaryStateBrackets[0]?.exemption_amount ?? 0

  const primaryStateTax = useMemo(() => {
    if (!statePrimary || !STATE_ESTATE_TAX_STATES.has(statePrimary.toUpperCase())) return null
    const code = statePrimary.toUpperCase()
    const atFirstDeath = resolveStateTaxForDeathPhase({
      grossEstate,
      stateCode: code,
      brackets: primaryStateBrackets,
      isMFJ,
      hasSpouse,
      deathPhase: 'first_death',
    })
    if (atFirstDeath.isFirstDeath) {
      return {
        state: code,
        state_taxable: 0,
        state_exemption: atFirstDeath.exemptionUsed || primaryStateExemption,
        state_estate_tax: 0,
        is_first_death: true,
      }
    }
    const atSecondDeath = resolveStateTaxForDeathPhase({
      grossEstate,
      stateCode: code,
      brackets: primaryStateBrackets,
      isMFJ,
      hasSpouse,
      deathPhase: 'second_death',
    })
    return {
      state: code,
      state_taxable: atSecondDeath.taxableEstate,
      state_exemption: atSecondDeath.exemptionUsed,
      state_estate_tax: atSecondDeath.activeStateTax,
      is_first_death: false,
    }
  }, [statePrimary, isMFJ, hasSpouse, grossEstate, primaryStateBrackets, primaryStateExemption])

  const compareStateBrackets = useMemo(() => {
    const latestYear = Math.max(...stateEstateTaxRows.map(r => num(r.tax_year)), 0)
    return stateEstateTaxRows
      .filter(r => num(r.tax_year) === latestYear && String(r.state ?? '').trim().toUpperCase() === stateCompare?.toUpperCase())
      .map((r) => ({
        min_amount:       num(r.min_amount),
        max_amount:       num(r.max_amount),
        rate_pct:         num(r.rate_pct),
        exemption_amount: num(r.exemption_amount),
      }))
  }, [stateEstateTaxRows, stateCompare])

  const compareStateTax = useMemo(() => {
    const sc = stateCompare?.toUpperCase()
    if (!sc || sc === statePrimary?.toUpperCase()) return null
    if (!STATE_ESTATE_TAX_STATES.has(sc)) return null
    const atFirstDeath = resolveStateTaxForDeathPhase({
      grossEstate,
      stateCode: sc,
      brackets: compareStateBrackets,
      isMFJ,
      hasSpouse,
      deathPhase: 'first_death',
    })
    if (atFirstDeath.isFirstDeath) {
      return {
        state: sc,
        state_taxable: 0,
        state_exemption: atFirstDeath.exemptionUsed || compareStateBrackets[0]?.exemption_amount ?? 0,
        state_estate_tax: 0,
        is_first_death: true,
      }
    }
    const atSecondDeath = resolveStateTaxForDeathPhase({
      grossEstate,
      stateCode: sc,
      brackets: compareStateBrackets,
      isMFJ,
      hasSpouse,
      deathPhase: 'second_death',
    })
    return {
      state: sc,
      state_taxable: atSecondDeath.taxableEstate,
      state_exemption: atSecondDeath.exemptionUsed,
      state_estate_tax: atSecondDeath.activeStateTax,
      is_first_death: false,
    }
  }, [stateCompare, statePrimary, isMFJ, hasSpouse, grossEstate, compareStateBrackets])

  const showComparison =
    !!stateCompare &&
    stateCompare.toUpperCase() !== statePrimary?.toUpperCase() &&
    (compareStateTax !== null || true)
  const engineStateEstateTaxAtSecondDeath = composition?.estimated_tax_state ?? 0

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

  function updateInheritShare(cls: BeneficiaryClass, pct: number) {
    setInheritShares((prev) => ({ ...prev, [cls]: Math.max(0, Math.min(100, pct)) }))
  }

  const totalSliderPct =
    inheritShares.spouse + inheritShares.child + inheritShares.sibling + inheritShares.other

  const [showWithStrategies, setShowWithStrategies] = useState(false)
  const [activeStrategyIds, setActiveStrategyIds] = useState<Set<string>>(new Set())

  function toggleStrategy(id: string) {
    setActiveStrategyIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const financialAssets = composition?.inside_financial ?? 0
  const realEstateFmv = composition?.inside_real_estate ?? 0
  const businessTotal = composition?.inside_business_gross ?? 0
  const insuranceTotal = composition?.inside_insurance ?? 0
  const insideBase = composition?.inside_total ?? grossEstate
  const outsideBase = composition?.outside_strategy_total ?? 0

  const stateExemption = primaryStateExemption
  const taxTermCtx: TaxTermContext = {
    stateCode: statePrimary ?? null,
    stateExemption: stateExemption > 0 ? stateExemption : null,
    isMFJ: isMFJ && hasSpouse,
  }
  const estimatedTaxFederal = federalTaxDisplay
  const estimatedTaxState =
    isMFJ && hasSpouse
      ? engineStateEstateTaxAtSecondDeath
      : (primaryStateTax?.state_estate_tax ?? engineStateEstateTaxAtSecondDeath ?? 0)

  const availableStrategies = useMemo(() => {
    const strategies: Array<{
      id: string
      label: string
      description: string
      taxSaving: number
      exclusionAmount: number
    }> = []

    for (const item of strategyLineItems ?? []) {
      const exclusion = item.estimated_exclusion ?? 0
      const effectiveRate = grossEstate > 0 ? estimatedTaxState / grossEstate : 0.1
      strategies.push({
        id: item.id,
        label: item.strategy_label ?? item.strategy_type,
        description: getStrategyDescription(item.strategy_type, statePrimary),
        taxSaving: Math.round(exclusion * effectiveRate),
        exclusionAmount: exclusion,
      })
    }

    const hasBypass = strategies.some(
      (s) =>
        s.label.toLowerCase().includes('bypass') ||
        s.label.toLowerCase().includes('credit shelter'),
    )
    if (
      !hasBypass &&
      statePrimary &&
      WA_NO_PORTABILITY_STATES.has(statePrimary.toUpperCase()) &&
      stateExemption > 0
    ) {
      const effectiveRate = grossEstate > 0 ? estimatedTaxState / grossEstate : 0.1
      strategies.push({
        id: 'bypass-trust-synthetic',
        label: 'Bypass trust (credit shelter)',
        description: `Moves $${(stateExemption / 1_000_000).toFixed(1)}M outside estate at first death · preserves ${statePrimary} exemption`,
        taxSaving: Math.round(stateExemption * effectiveRate),
        exclusionAmount: stateExemption,
      })
    }

    const hasIlit = strategies.some(
      (s) =>
        s.label.toLowerCase().includes('ilit') || s.label.toLowerCase().includes('insurance'),
    )
    if (!hasIlit && insuranceTotal > 0) {
      const effectiveRate = grossEstate > 0 ? estimatedTaxState / grossEstate : 0.1
      strategies.push({
        id: 'ilit-synthetic',
        label: 'ILIT (life insurance trust)',
        description: `Moves $${Math.round(insuranceTotal / 1000)}K life insurance policy outside estate`,
        taxSaving: Math.round(insuranceTotal * effectiveRate),
        exclusionAmount: insuranceTotal,
      })
    }

    const hasGifting = strategies.some((s) => s.label.toLowerCase().includes('gift'))
    if (!hasGifting && estimatedTaxState > 0) {
      const annualExclusion = annualGiftingCapacity(isMFJFilingStatus(household?.filing_status as string))
      const effectiveRate = grossEstate > 0 ? estimatedTaxState / grossEstate : 0.1
      strategies.push({
        id: 'gifting-synthetic',
        label: 'Annual gifting program',
        description: `$${(annualExclusion / 1000).toFixed(0)}K/yr exclusion · moves assets out over time`,
        taxSaving: Math.round(annualExclusion * effectiveRate),
        exclusionAmount: annualExclusion,
      })
    }

    return strategies
  }, [
    strategyLineItems,
    grossEstate,
    estimatedTaxState,
    statePrimary,
    stateExemption,
    insuranceTotal,
    household?.filing_status,
  ])

  const totalStrategySaving = useMemo(
    () =>
      availableStrategies
        .filter((s) => activeStrategyIds.has(s.id))
        .reduce((sum, s) => sum + s.taxSaving, 0),
    [availableStrategies, activeStrategyIds],
  )

  const toggledExclusionTotal = useMemo(
    () =>
      availableStrategies
        .filter((s) => activeStrategyIds.has(s.id))
        .reduce((sum, s) => sum + s.exclusionAmount, 0),
    [availableStrategies, activeStrategyIds],
  )

  const outsideWithStrategies = outsideBase + toggledExclusionTotal
  const insideWithStrategies = Math.max(0, insideBase - toggledExclusionTotal)
  const displayInside = showWithStrategies ? insideWithStrategies : insideBase
  const displayOutside = showWithStrategies ? outsideWithStrategies : outsideBase

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">

      {/* ── Header ── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[color:var(--mwm-navy)]">Estate Tax Snapshot</h1>
      </div>

      {/* ── Estate composition waterfall ── */}
      {compositionLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse mb-6">
          <div className="h-4 bg-gray-100 rounded w-48 mb-4" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-32 bg-gray-100 rounded-lg" />
            <div className="h-32 bg-gray-100 rounded-lg" />
          </div>
        </div>
      ) : composition ? (
        <>
          <div className="mb-6 rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-medium text-[color:var(--mwm-navy)]">Estate composition</p>
                <p className="text-xs text-[color:var(--mwm-text-secondary)] mt-0.5">
                  What&apos;s inside vs. outside your taxable estate
                </p>
              </div>
              <div className="flex overflow-hidden rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)]">
                <button
                  type="button"
                  onClick={() => setShowWithStrategies(false)}
                  className={`px-3 py-1.5 text-xs border-r border-[color:var(--mwm-border)] ${
                    !showWithStrategies
                      ? 'bg-[var(--mwm-bg-muted)] font-medium text-[color:var(--mwm-navy)]'
                      : 'text-[color:var(--mwm-text-secondary)]'
                  }`}
                >
                  Current
                </button>
                <button
                  type="button"
                  onClick={() => setShowWithStrategies(true)}
                  className={`px-3 py-1.5 text-xs ${
                    showWithStrategies
                      ? 'bg-[var(--mwm-bg-muted)] font-medium text-[color:var(--mwm-navy)]'
                      : 'text-[color:var(--mwm-text-secondary)]'
                  }`}
                >
                  With strategies
                </button>
              </div>
            </div>

            <div className="space-y-0">
              <div className="flex items-center gap-3 border-b border-[color:var(--mwm-border)] py-2">
                <p className="flex-1 text-xs font-medium text-[color:var(--mwm-navy)]">Inside taxable estate</p>
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-[var(--mwm-bg-muted)]">
                  <div className="h-full rounded-full bg-red-400" style={{ width: '100%' }} />
                </div>
                <p className="w-24 text-right text-xs font-medium text-red-700">
                  {formatDollars(displayInside)}
                </p>
              </div>

              {[
                { label: 'Financial assets', value: financialAssets },
                { label: 'Real estate', value: realEstateFmv },
                { label: 'Business interests', value: businessTotal },
                { label: 'Life insurance', value: insuranceTotal },
              ]
                .filter((r) => r.value > 0)
                .map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center gap-3 border-b border-[color:var(--mwm-border)] py-1.5 pl-4"
                  >
                    <p className="flex-1 text-xs text-[color:var(--mwm-text-secondary)]">{row.label}</p>
                    <div className="h-1.5 w-32 overflow-hidden rounded-full bg-[var(--mwm-bg-muted)]">
                      <div
                        className="h-full rounded-full bg-red-200"
                        style={{
                          width: `${Math.min(100, Math.round((row.value / Math.max(grossEstate, 1)) * 100))}%`,
                        }}
                      />
                    </div>
                    <p className="w-24 text-right text-xs text-[color:var(--mwm-text-secondary)]">
                      {formatDollars(row.value)}
                    </p>
                  </div>
                ))}

              <div className="flex items-center gap-3 border-b border-[color:var(--mwm-border)] py-2">
                <p className="flex-1 text-xs font-medium text-[color:var(--mwm-navy)]">
                  Outside taxable estate
                  <span className="ml-2 inline-block rounded px-1.5 py-0.5 text-[9px] font-medium bg-emerald-100 text-emerald-800">
                    Strategies move assets here
                  </span>
                </p>
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-[var(--mwm-bg-muted)]">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{
                      width: `${Math.min(100, Math.round((displayOutside / Math.max(grossEstate, 1)) * 100))}%`,
                    }}
                  />
                </div>
                <p className="w-24 text-right text-xs font-medium text-emerald-700">
                  {formatDollars(displayOutside)}
                </p>
              </div>

              {showWithStrategies &&
                availableStrategies
                  .filter((s) => activeStrategyIds.has(s.id))
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 border-b border-[color:var(--mwm-border)] py-1.5 pl-4"
                    >
                      <p className="flex-1 text-xs text-emerald-700">{s.label}</p>
                      <div className="h-1.5 w-32" />
                      <p className="w-24 text-right text-xs text-emerald-700">
                        {formatDollars(s.exclusionAmount)}
                      </p>
                    </div>
                  ))}

              {statePrimary && (
                <>
                  <div className="flex items-center gap-3 rounded-[var(--mwm-radius)] bg-[var(--mwm-bg-muted)] px-3 py-2 mt-1">
                    <p className="flex-1 text-xs font-medium text-[color:var(--mwm-navy)]">
                      {statePrimary} taxable estate
                    </p>
                    <div className="h-1.5 w-32 overflow-hidden rounded-full bg-[var(--mwm-bg-muted)]">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              Math.round(
                                ((displayInside - stateExemption) / Math.max(grossEstate, 1)) * 100,
                              ),
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="w-24 text-right text-xs font-medium text-[color:var(--mwm-navy)]">
                      {formatDollars(Math.max(0, displayInside - stateExemption))}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 border-b border-[color:var(--mwm-border)] py-1.5 pl-4">
                    <p className="flex-1 text-xs text-[color:var(--mwm-text-secondary)]">
                      <span className="inline-flex items-center gap-1">
                        {statePrimary} exemption
                        <InfoTooltip
                          content={taxTermExplainer('state_exemption', taxTermCtx)}
                          size="sm"
                        />
                      </span>
                      {noPortability && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[9px] text-amber-700">
                          Individual only · no portability
                          <InfoTooltip
                            content={taxTermExplainer('state_no_portability', taxTermCtx)}
                            size="sm"
                          />
                        </span>
                      )}
                    </p>
                    <div className="h-1.5 w-32" />
                    <p className="w-24 text-right text-xs text-[color:var(--mwm-text-secondary)]">
                      −{formatDollars(stateExemption)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 rounded-[var(--mwm-radius)] bg-red-50 border border-red-200 px-3 py-2 mt-1">
                    <p className="flex-1 text-xs font-medium text-red-800">
                      <span className="inline-flex items-center gap-1">
                        Est. {statePrimary} estate tax
                        <InfoTooltip
                          content={taxTermExplainer('state_exemption', taxTermCtx)}
                          size="sm"
                        />
                      </span>
                    </p>
                    <div className="h-1.5 w-32" />
                    <p className="w-24 text-right text-xs font-medium text-red-700">
                      {formatDollars(estimatedTaxState)}
                    </p>
                  </div>
                  {mcUpdating && (
                    <p className="mt-2 text-xs font-medium text-amber-700">
                      Updating Monte Carlo analysis — showing last saved results.
                    </p>
                  )}
                  {waThresholdToday && waThresholdToday.pct_above_threshold > 0 && (
                    <div className="mt-2 text-xs text-[--mwm-text-muted]">
                      {waThresholdToday.pct_above_threshold === 100
                        ? `Your estate exceeds the ${statePrimary} exemption in all simulated market scenarios.`
                        : `Your estate exceeds the ${statePrimary} exemption in ${waThresholdToday.pct_above_threshold}% of simulated market scenarios.`}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {(estimatedTaxState > 0 || estimatedTaxFederal > 0) && (
            <div className="mb-6 rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white p-5">
              <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-[color:var(--mwm-navy)]">
                    Strategies that reduce your estate tax
                  </p>
                  <p className="text-xs text-[color:var(--mwm-text-secondary)] mt-0.5">
                    Toggle to see how each strategy moves assets outside your taxable estate
                  </p>
                </div>
                <Link href="/gifting" className="text-xs text-emerald-700 underline underline-offset-2">
                  View Gifting & Trusts →
                </Link>
              </div>

              <div className="flex flex-col gap-2 mb-4">
                {availableStrategies.map((strategy) => {
                  const isActive = activeStrategyIds.has(strategy.id)
                  return (
                    <button
                      key={strategy.id}
                      type="button"
                      onClick={() => toggleStrategy(strategy.id)}
                      className={[
                        'flex items-center gap-3 rounded-[var(--mwm-radius)] p-3 text-left transition-colors',
                        isActive
                          ? 'bg-emerald-50 border border-emerald-200'
                          : 'bg-[var(--mwm-bg-muted)] border border-transparent',
                      ].join(' ')}
                    >
                      <div
                        className={[
                          'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border',
                          isActive
                            ? 'border-emerald-500 bg-emerald-500'
                            : 'border-[color:var(--mwm-border-secondary)]',
                        ].join(' ')}
                      >
                        {isActive && (
                          <i
                            className="ti ti-check text-white"
                            aria-hidden="true"
                            style={{ fontSize: 10 }}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[color:var(--mwm-navy)]">{strategy.label}</p>
                        <p className="text-[10px] text-[color:var(--mwm-text-secondary)] mt-0.5">
                          {strategy.description}
                        </p>
                      </div>
                      <p className="text-xs font-medium text-emerald-700 flex-shrink-0">
                        −{formatDollars(strategy.taxSaving)} tax
                      </p>
                    </button>
                  )
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-[color:var(--mwm-border)] pt-4">
                <div className="rounded-[var(--mwm-radius)] bg-[var(--mwm-bg-muted)] p-3">
                  <p className="text-[10px] text-[color:var(--mwm-text-secondary)] mb-1">Current tax</p>
                  <p className="text-base font-medium text-red-700">{formatDollars(estimatedTaxState)}</p>
                </div>
                <div className="rounded-[var(--mwm-radius)] bg-[var(--mwm-bg-muted)] p-3">
                  <p className="text-[10px] text-[color:var(--mwm-text-secondary)] mb-1">
                    With selected strategies
                  </p>
                  <p
                    className="text-base font-medium"
                    style={{
                      color: activeStrategyIds.size > 0 ? '#854F0B' : 'var(--color-text-primary)',
                    }}
                  >
                    {formatDollars(Math.max(0, estimatedTaxState - totalStrategySaving))}
                  </p>
                  {totalStrategySaving > 0 && (
                    <p className="text-[10px] text-emerald-700 mt-0.5">
                      −{formatDollars(totalStrategySaving)} saved
                    </p>
                  )}
                </div>
                <div className="rounded-[var(--mwm-radius)] bg-[var(--mwm-bg-muted)] p-3">
                  <p className="text-[10px] text-[color:var(--mwm-text-secondary)] mb-1">Outside estate</p>
                  <p className="text-base font-medium text-emerald-700">{formatDollars(displayOutside)}</p>
                  {displayOutside > 0 && (
                    <p className="text-[10px] text-[color:var(--mwm-text-secondary)] mt-0.5">
                      moved by strategies
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
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
                value={formatDollars(grossEstateDisplay)}
                sub="Financial + real estate FMV + business + insurance"
                labelTooltip={
                  <InfoTooltip content={taxTermExplainer('gross_estate')} size="sm" />
                }
              />
              <SummaryCard
                label="Taxable Estate"
                value={formatDollars(taxableEstateDisplay)}
                sub="From your estate composition snapshot"
                labelTooltip={
                  <InfoTooltip content={taxTermExplainer('taxable_estate')} size="sm" />
                }
              />
              <SummaryCard
                label={FEDERAL_EXEMPTION_AFTER_GIFTS_LABEL}
                value={formatDollars(federalExemptionDisplay)}
                sub={
                  (composition?.lifetime_gifts_used ?? 0) > 0
                    ? `After ${formatDollars(composition!.lifetime_gifts_used!)} lifetime gifts used`
                    : filing === 'married_joint'
                      ? '$30M MFJ (OBBBA 2026)'
                      : '$15M single (OBBBA 2026)'
                }
                labelTooltip={
                  <InfoTooltip content={taxTermExplainer('federal_exemption')} size="sm" />
                }
              />
              <div>
                <SummaryCard
                  label="Federal Estate Tax"
                  value={formatDollars(federalTaxDisplay)}
                  labelTooltip={
                    <InfoTooltip content={taxTermExplainer('federal_exemption')} size="sm" />
                  }
                  sub={
                    federalTaxDisplay > 0
                      ? 'Estimated federal transfer tax'
                      : 'No estimated federal tax due'
                  }
                  highlight={federalTaxDisplay > 0 ? 'red' : 'green'}
                />
                <p className="text-xs text-neutral-400 mt-1 max-w-xs">{DISCLAIMER_STRINGS.estateTax}</p>
              </div>
            </div>

            {/* No-tax green state */}
            {federalTaxDisplay === 0 && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800 mb-4">
                <p className="font-semibold">No federal estate tax estimated</p>
                <p className="mt-1 leading-relaxed">
                  Your taxable estate of {formatDollars(taxableEstateDisplay)} is below your available
                  federal exemption of {formatDollars(federalExemptionDisplay)}. Federal estate tax becomes
                  a consideration only when taxable estate exceeds that amount.
                </p>
                {composition && composition.exemption_remaining > 0 && (
                  <p className="mt-2 text-sm text-green-800">
                    <span className="font-semibold">{HEADROOM_BEFORE_FEDERAL_TAX_LABEL}:</span>{' '}
                    <span className="tabular-nums font-semibold">
                      {formatDollars(composition.exemption_remaining)}
                    </span>
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
              {statePrimary && isWaState(statePrimary) && (
                <div className="text-xs text-neutral-600 leading-relaxed rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2 sm:col-span-2">
                  <p>{WA_ESTATE_TAX_CONSUMER_SUMMARY}</p>
                  <details className="mt-2 group">
                    <summary className="cursor-pointer text-neutral-700 font-medium list-none [&::-webkit-details-marker]:hidden">
                      <span className="underline decoration-dotted underline-offset-2">
                        How these estimates work
                      </span>
                    </summary>
                    <p className="mt-2 text-neutral-600">{WA_ESTATE_TAX_CONSUMER_DETAIL}</p>
                  </details>
                </div>
              )}

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
                        exemption. Without a Credit Shelter Trust, the first spouse&apos;s exemption is
                        permanently lost — worth discussing with your estate attorney.
                      </p>
                    </div>
                  )}
                  <div className="space-y-2 text-sm">
                    {isMFJ && hasSpouse && (
                      <div className="flex justify-between pt-2 border-t border-neutral-100">
                        <span className="font-semibold text-neutral-900">
                          State estate tax (first death)
                        </span>
                        <span className="text-lg font-bold tabular-nums text-green-600">
                          $0 — marital deduction
                        </span>
                      </div>
                    )}
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
                    {isMFJ && hasSpouse && (
                      <div className="flex justify-between">
                        <span className="text-neutral-600">State estate tax (at second death)</span>
                        <span className={`font-medium tabular-nums ${engineStateEstateTaxAtSecondDeath > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatDollars(engineStateEstateTaxAtSecondDeath)}
                        </span>
                      </div>
                    )}
                    {!isMFJ && (
                      <div className="flex justify-between pt-2 border-t border-neutral-100">
                        <span className="font-semibold text-neutral-900">State estate tax</span>
                        <span className={`text-lg font-bold tabular-nums ${primaryStateTax.state_estate_tax > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatDollars(primaryStateTax.state_estate_tax)}
                        </span>
                      </div>
                    )}
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
          {statePrimary &&
            Object.values(STATE_SLUG_MAP).includes(statePrimary.toUpperCase()) && (
              <p className="mt-4 text-sm">
                <Link
                  href={`/learn/${stateCodeToSlug(statePrimary)}`}
                  className="font-medium text-[color:var(--mwm-navy)] hover:underline"
                >
                  Learn about {getStateDisplayName(statePrimary)} estate tax planning →
                </Link>
              </p>
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
            Inheritance tax is assessed on the beneficiary&apos;s share. Allocate the estate below to see
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
        Estate tax figures are calculated from your entered assets, titling, and applicable federal and state rules. Review with your estate attorney for transaction-specific decisions.
      </p>
    </div>
  )
}
