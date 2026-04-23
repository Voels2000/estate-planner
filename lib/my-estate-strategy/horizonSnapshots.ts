// Facts-only estate snapshots for My Estate Strategy (four horizons).
// Federal constants come from OBBBA 2026 — see lib/tax/estate-tax-constants.ts.
// No sunset scenario: the One Big Beautiful Bill Act made the exemption permanent.

import { computeStateEstateTaxFromBrackets, type StateBracket } from '@/lib/calculations/estate-tax-projection'
import { calculateStateEstateTax, parseStateTaxCode } from '@/lib/projection/stateRegistry'
import type { AnnualOutput } from '@/lib/types/projection-scenario'
import { OBBBA_2026 } from '@/lib/tax/estate-tax-constants'

function isMarriedFilingJoint(filingStatus: string | null | undefined): boolean {
  const fs = (filingStatus ?? '').toLowerCase()
  return fs === 'mfj' || fs === 'married_filing_jointly' || fs === 'married filing jointly'
}

/** Returns OBBBA 2026 basic exclusion for the household. */
export function householdFederalExemption(
  filingStatus: string | null | undefined,
  hasSpouse: boolean,
): number {
  if (isMarriedFilingJoint(filingStatus) && hasSpouse) return OBBBA_2026.BASIC_EXCLUSION_MFJ
  return OBBBA_2026.BASIC_EXCLUSION_SINGLE
}

export function estimateFederalEstateTaxSnapshot(params: {
  grossEstate: number
  filingStatus: string | null | undefined
  hasSpouse: boolean
}): { exemption: number; federalExposure: number; federalTax: number } {
  const { grossEstate, filingStatus, hasSpouse } = params
  const exemption = householdFederalExemption(filingStatus, hasSpouse)
  const federalExposure = Math.max(0, grossEstate - exemption)
  const federalTax = Math.round(federalExposure * OBBBA_2026.TOP_RATE)
  return { exemption, federalExposure, federalTax }
}

export function longevityAndSurvivor(params: {
  hasSpouse: boolean
  person1Longevity: number | null | undefined
  person2Longevity: number | null | undefined
}): { longevityAge: number; survivorIsPerson1: boolean } {
  const { hasSpouse, person1Longevity, person2Longevity } = params
  const p1 = person1Longevity ?? 90
  const p2 = person2Longevity ?? 90
  if (!hasSpouse) {
    return { longevityAge: person1Longevity ?? 90, survivorIsPerson1: true }
  }
  if (p1 >= p2) return { longevityAge: p1, survivorIsPerson1: true }
  return { longevityAge: p2, survivorIsPerson1: false }
}

export function findTenYearRow(rows: AnnualOutput[], currentYear: number): AnnualOutput | undefined {
  const target = currentYear + 10
  return rows.find((r) => r.year === target)
}

export function findTwentyYearRow(rows: AnnualOutput[], currentYear: number): AnnualOutput | undefined {
  const target = currentYear + 20
  return rows.find((r) => r.year === target)
}

export function findAtDeathRow(
  rows: AnnualOutput[],
  params: {
    hasSpouse: boolean
    person1BirthYear: number | null | undefined
    person2BirthYear: number | null | undefined
    person1Longevity: number | null | undefined
    person2Longevity: number | null | undefined
  },
): AnnualOutput | undefined {
  if (!rows.length) return undefined
  const { hasSpouse, person1BirthYear, person2BirthYear, person1Longevity, person2Longevity } = params
  const { longevityAge, survivorIsPerson1 } = longevityAndSurvivor({
    hasSpouse,
    person1Longevity,
    person2Longevity,
  })
  const birth = survivorIsPerson1 ? person1BirthYear : person2BirthYear
  const deathYear = (birth ?? new Date().getFullYear()) + longevityAge
  return rows.find((r) => r.year === deathYear) ?? rows[rows.length - 1]
}

export function grossEstateFromRow(row: AnnualOutput | undefined | null): number {
  if (!row) return 0
  return Number(row.estate_incl_home ?? 0)
}

/**
 * Ownership-weighted business value from `businesses` and legacy `business_interests`.
 * Mirrors the merge in `lib/actions/generate-base-case.ts`.
 */
export function computeBusinessOwnershipValue(
  businesses: { estimated_value?: unknown; ownership_pct?: unknown }[],
  businessInterests: {
    fmv_estimated?: unknown
    total_entity_value?: unknown
    ownership_pct?: unknown
  }[],
): number {
  const modern = (businesses ?? []).reduce(
    (s, b) => s + Number(b.estimated_value ?? 0) * (Number(b.ownership_pct ?? 100) / 100),
    0,
  )
  const legacy = (businessInterests ?? []).reduce((s, b) => {
    const base = Number(b.fmv_estimated ?? b.total_entity_value ?? 0)
    const pct = Number(b.ownership_pct ?? 100) / 100
    return s + base * pct
  }, 0)
  return modern + legacy
}

export function computeColumnTaxes(params: {
  grossEstate: number
  calendarYear: number
  statePrimary: string | null | undefined
  filingStatus: string | null | undefined
  hasSpouse: boolean
  stateBrackets?: StateBracket[]
}): {
  federalExemption: number
  federalExposure: number
  federalTax: number
  stateExposure: number
  totalTax: number
} {
  const { grossEstate, calendarYear, statePrimary, filingStatus, hasSpouse } = params
  const exemption = householdFederalExemption(filingStatus, hasSpouse)
  if (grossEstate <= 0) {
    return {
      federalExemption: exemption,
      federalExposure: 0,
      federalTax: 0,
      stateExposure: 0,
      totalTax: 0,
    }
  }
  const { federalExposure, federalTax } = estimateFederalEstateTaxSnapshot({
    grossEstate,
    filingStatus,
    hasSpouse,
  })
  const brackets = params.stateBrackets ?? []
  const stateTax = brackets.length > 0
    ? computeStateEstateTaxFromBrackets(grossEstate, brackets)
    : (() => {
        const stateCode = parseStateTaxCode(statePrimary)
        return calculateStateEstateTax({
          grossEstate,
          stateCode,
          year: calendarYear,
          federalExemption: exemption,
        }).stateTax
      })()
  return {
    federalExemption: exemption,
    federalExposure,
    federalTax,
    stateExposure: stateTax,
    totalTax: federalTax + stateTax,
  }
}

export type StrategyHorizonColumn = {
  headerTitle: string
  headerClassName: string
  narrative: string
  grossEstate: number | null
  federalExemption: number | null
  federalExposure: number | null
  federalTaxEstimate: number | null
  stateExposure: number | null
  totalTaxLiability: number | null
  /** No values to show (empty column) */
  isPlaceholder: boolean
  /** No base case — prompt user to generate a plan */
  showGenerateCta: boolean
  /** Base case exists but the projection has no row for this horizon year */
  showMissingRowNote?: boolean
  /** Calendar year we looked for when `showMissingRowNote` */
  missingRowCalendarYear?: number
  insideTotal?: number | null
  outsideCertainProbableTotal?: number | null
  outsideIllustrativeTotal?: number | null
}

export type BuildHorizonsInput = {
  currentYear: number
  currentMonthYearLabel: string
  liveNetWorth: number
  stateBrackets?: StateBracket[]
  strategyLineItems?: Array<{
    amount: number
    confidence_level: 'certain' | 'probable' | 'illustrative'
    effective_year: number | null
    is_active: boolean
    /** Reductions (default) vs additions; matches `strategy_line_items.sign`. */
    sign?: number
  }>
  household: {
    state_primary: string | null
    filing_status: string | null
    has_spouse: boolean | null
    person1_name: string | null
    person2_name: string | null
    person1_birth_year: number | null
    person2_birth_year: number | null
    person1_longevity_age: number | null
    person2_longevity_age: number | null
  }
  scenarioRows: AnnualOutput[] | null
  survivorFirstName: string
  longevityAge: number
}

export type MyEstateStrategyHorizonsResult = ReturnType<typeof buildStrategyHorizons>

/**
 * Sums strategy line items into outside-estate buckets for a calendar horizon.
 * Illustrative items always count toward illustrative (Session 27 / horizon cards).
 * Certain/probable items count only once effective_year has passed (or is unset).
 */
function computeOutsideForHorizon(
  strategyLineItems: BuildHorizonsInput['strategyLineItems'],
  horizonCalendarYear: number,
): { certainProbable: number; illustrative: number } {
  const items = (strategyLineItems ?? []).filter((i) => i.is_active)
  let certainProbable = 0
  let illustrative = 0
  for (const item of items) {
    if ((item.sign ?? -1) !== -1) continue
    const amt = Number(item.amount) || 0
    const transferred =
      item.effective_year === null || item.effective_year <= horizonCalendarYear

    if (item.confidence_level === 'illustrative') {
      illustrative += amt
      continue
    }

    if (!transferred) continue
    certainProbable += amt
  }
  return { certainProbable, illustrative }
}

export function buildStrategyHorizons(input: BuildHorizonsInput): {
  today: StrategyHorizonColumn
  tenYear: StrategyHorizonColumn
  twentyYear: StrategyHorizonColumn
  atDeath: StrategyHorizonColumn
  showProjectionMismatchNote: boolean
  grossAtDeathByLongevity: number
  grossAtDeathFinalRow: number
} {
  const {
    currentYear,
    currentMonthYearLabel,
    liveNetWorth,
    stateBrackets,
    household,
    scenarioRows,
    survivorFirstName,
    longevityAge,
    strategyLineItems,
  } = input

  const hasSpouse = household.has_spouse ?? false
  const fs = household.filing_status
  const statePrimary = household.state_primary

  const rows = scenarioRows ?? []
  const hasBaseCase = rows.length > 0

  const y10 = hasBaseCase ? findTenYearRow(rows, currentYear) : undefined
  const y20 = hasBaseCase ? findTwentyYearRow(rows, currentYear) : undefined
  const atDeathRow = hasBaseCase
    ? findAtDeathRow(rows, {
        hasSpouse,
        person1BirthYear: household.person1_birth_year,
        person2BirthYear: household.person2_birth_year,
        person1Longevity: household.person1_longevity_age,
        person2Longevity: household.person2_longevity_age,
      })
    : undefined

  const finalRow = hasBaseCase ? rows[rows.length - 1] : undefined
  const grossAtDeathFinalRow = grossEstateFromRow(finalRow)
  const grossAtDeathByLongevity = grossEstateFromRow(atDeathRow)

  const showProjectionMismatchNote =
    hasBaseCase && Math.abs(grossAtDeathByLongevity - grossAtDeathFinalRow) > 10_000

  // ── Today column ──────────────────────────────────────────────────────
  const todayTax = computeColumnTaxes({
    grossEstate: liveNetWorth,
    calendarYear: currentYear,
    statePrimary,
    filingStatus: fs,
    hasSpouse,
    stateBrackets,
  })

  const todayOutside = computeOutsideForHorizon(strategyLineItems, currentYear)

  const today: StrategyHorizonColumn = {
    headerTitle: 'Today',
    headerClassName: 'bg-slate-600 text-white',
    narrative: `Your estate as of ${currentMonthYearLabel}. All figures are estimates.`,
    grossEstate: liveNetWorth,
    federalExemption: todayTax.federalExemption,
    federalExposure: todayTax.federalExposure,
    federalTaxEstimate: todayTax.federalTax,
    stateExposure: todayTax.stateExposure,
    totalTaxLiability: todayTax.totalTax,
    isPlaceholder: false,
    showGenerateCta: false,
    insideTotal: Math.max(
      0,
      liveNetWorth - todayOutside.certainProbable - todayOutside.illustrative,
    ),
    outsideCertainProbableTotal: todayOutside.certainProbable,
    outsideIllustrativeTotal: todayOutside.illustrative,
  }

  // ── Helper to build projected horizon columns ─────────────────────────
  function buildProjectedColumn(
    headerTitle: string,
    headerClassName: string,
    targetYear: number,
    row: AnnualOutput | undefined,
  ): StrategyHorizonColumn {
    if (!hasBaseCase) {
      return {
        headerTitle,
        headerClassName,
        narrative: `Your projected estate in ${targetYear}. All figures are estimates.`,
        grossEstate: null,
        federalExemption: null,
        federalExposure: null,
        federalTaxEstimate: null,
        stateExposure: null,
        totalTaxLiability: null,
        isPlaceholder: true,
        showGenerateCta: true,
      }
    }
    const gross = row ? grossEstateFromRow(row) : null
    const outside = computeOutsideForHorizon(strategyLineItems, targetYear)
    const insideTotal =
      gross !== null
        ? Math.max(0, gross - outside.certainProbable - outside.illustrative)
        : null
    const tax = gross !== null ? computeColumnTaxes({
      grossEstate: gross,
      calendarYear: targetYear,
      statePrimary,
      filingStatus: fs,
      hasSpouse,
      stateBrackets,
    }) : null
    return {
      headerTitle,
      headerClassName,
      narrative: `Your projected estate in ${targetYear}. All figures are estimates.`,
      grossEstate: gross,
      federalExemption: tax?.federalExemption ?? null,
      federalExposure: tax?.federalExposure ?? null,
      federalTaxEstimate: tax?.federalTax ?? null,
      stateExposure: tax?.stateExposure ?? null,
      totalTaxLiability: tax?.totalTax ?? null,
      isPlaceholder: !row,
      showGenerateCta: false,
      showMissingRowNote: !row,
      missingRowCalendarYear: targetYear,
      insideTotal: row ? insideTotal : null,
      outsideCertainProbableTotal: row ? outside.certainProbable : null,
      outsideIllustrativeTotal: row ? outside.illustrative : null,
    }
  }

  const tenYear = buildProjectedColumn('In 10 Years', 'bg-blue-600 text-white', currentYear + 10, y10)
  const twentyYear = buildProjectedColumn('In 20 Years', 'bg-indigo-600 text-white', currentYear + 20, y20)

  // ── At Death column ───────────────────────────────────────────────────
  const atDeathCalendarYear = atDeathRow?.year ?? currentYear
  const atDeathGross = atDeathRow ? grossEstateFromRow(atDeathRow) : null
  const atDeathOutside = computeOutsideForHorizon(strategyLineItems, atDeathCalendarYear)
  const atDeathInsideTotal =
    atDeathGross !== null
      ? Math.max(0, atDeathGross - atDeathOutside.certainProbable - atDeathOutside.illustrative)
      : null
  const atDeathTax =
    atDeathGross !== null && hasBaseCase
      ? computeColumnTaxes({
          grossEstate: atDeathGross,
          calendarYear: atDeathCalendarYear,
          statePrimary,
          filingStatus: fs,
          hasSpouse,
          stateBrackets,
        })
      : null

  const atDeath: StrategyHorizonColumn = hasBaseCase
    ? {
        headerTitle: `At Death (Age ${longevityAge}, ${survivorFirstName})`,
        headerClassName: 'bg-violet-900 text-white',
        narrative: `Your projected estate at age ${longevityAge} (${survivorFirstName}), based on your current growth assumptions. All figures are estimates.`,
        grossEstate: atDeathGross,
        federalExemption: atDeathTax?.federalExemption ?? null,
        federalExposure: atDeathTax?.federalExposure ?? null,
        federalTaxEstimate: atDeathTax?.federalTax ?? null,
        stateExposure: atDeathTax?.stateExposure ?? null,
        totalTaxLiability: atDeathTax?.totalTax ?? null,
        isPlaceholder: false,
        showGenerateCta: false,
        insideTotal: atDeathInsideTotal,
        outsideCertainProbableTotal: atDeathOutside.certainProbable,
        outsideIllustrativeTotal: atDeathOutside.illustrative,
      }
    : {
        headerTitle: `At Death (Age ${longevityAge}, ${survivorFirstName})`,
        headerClassName: 'bg-violet-900 text-white',
        narrative: `Your projected estate at age ${longevityAge} (${survivorFirstName}), based on your current growth assumptions. All figures are estimates.`,
        grossEstate: null,
        federalExemption: null,
        federalExposure: null,
        federalTaxEstimate: null,
        stateExposure: null,
        totalTaxLiability: null,
        isPlaceholder: true,
        showGenerateCta: true,
      }

  return {
    today,
    tenYear,
    twentyYear,
    atDeath,
    showProjectionMismatchNote,
    grossAtDeathByLongevity,
    grossAtDeathFinalRow,
  }
}
