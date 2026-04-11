// Facts-only estate snapshots for My Estate Strategy (three horizons).
// Federal: exemption + flat top-rate estimate from active federal_tax_config (sunset-aware by calendar year).

import { calculateStateEstateTax, parseStateTaxCode } from '@/lib/projection/stateRegistry'
import type { AnnualOutput } from '@/lib/types/projection-scenario'

export type FederalConfigRow = {
  scenario_id: string
  estate_exemption_individual: number
  estate_exemption_married: number
  estate_top_rate_pct: number
}

export function pickFederalConfigForCalendarYear(
  year: number,
  configs: FederalConfigRow[],
): FederalConfigRow | null {
  const sunset = configs.find((c) => c.scenario_id === 'sunset_2026')
  const extended = configs.find((c) => c.scenario_id === 'current_law_extended')
  if (year >= 2026 && sunset) return sunset
  if (extended) return extended
  return configs[0] ?? null
}

function isMarriedFilingJoint(filingStatus: string | null | undefined): boolean {
  const fs = (filingStatus ?? '').toLowerCase()
  return fs === 'mfj' || fs === 'married_filing_jointly' || fs === 'married filing jointly'
}

export function householdFederalExemption(
  config: FederalConfigRow,
  filingStatus: string | null | undefined,
  hasSpouse: boolean,
): number {
  if (isMarriedFilingJoint(filingStatus) && hasSpouse) return config.estate_exemption_married
  return config.estate_exemption_individual
}

export function estimateFederalEstateTaxSnapshot(params: {
  grossEstate: number
  config: FederalConfigRow
  filingStatus: string | null | undefined
  hasSpouse: boolean
}): { exemption: number; federalExposure: number; federalTax: number } {
  const { grossEstate, config, filingStatus, hasSpouse } = params
  const exemption = householdFederalExemption(config, filingStatus, hasSpouse)
  const federalExposure = Math.max(0, grossEstate - exemption)
  const federalTax = Math.round(federalExposure * (config.estate_top_rate_pct / 100))
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
  const { hasSpouse, person1BirthYear, person2BirthYear, person1Longevity, person2Longevity } =
    params
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
 * Mirrors the merge in `lib/actions/generate-base-case.ts` (both tables, `ownership_pct` on each row).
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
    (s, b) =>
      s + Number(b.estimated_value ?? 0) * (Number(b.ownership_pct ?? 100) / 100),
    0,
  )
  const legacy = (businessInterests ?? []).reduce((s, b) => {
    const base = Number(
      b.fmv_estimated ?? b.total_entity_value ?? 0,
    )
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
  federalConfigs: FederalConfigRow[]
}): {
  federalExemption: number
  federalExposure: number
  federalTax: number
  stateExposure: number
  totalTax: number
} {
  const { grossEstate, calendarYear, statePrimary, filingStatus, hasSpouse, federalConfigs } =
    params
  const config = pickFederalConfigForCalendarYear(calendarYear, federalConfigs)
  if (!config) {
    return {
      federalExemption: 0,
      federalExposure: 0,
      federalTax: 0,
      stateExposure: 0,
      totalTax: 0,
    }
  }
  const exemption = householdFederalExemption(config, filingStatus, hasSpouse)
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
    config,
    filingStatus,
    hasSpouse,
  })
  const stateCode = parseStateTaxCode(statePrimary)
  const { stateTax } = calculateStateEstateTax({
    grossEstate,
    stateCode,
    year: calendarYear,
    federalExemption: exemption,
  })
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
  /** Calendar year we looked for (e.g. 10-year horizon) when `showMissingRowNote` */
  missingRowCalendarYear?: number
}

export type BuildHorizonsInput = {
  currentYear: number
  currentMonthYearLabel: string
  liveNetWorth: number
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
  federalConfigs: FederalConfigRow[]
  scenarioRows: AnnualOutput[] | null
  survivorFirstName: string
  longevityAge: number
}

const FALLBACK_FEDERAL_CONFIGS: FederalConfigRow[] = [
  {
    scenario_id: 'current_law_extended',
    estate_exemption_individual: 13_610_000,
    estate_exemption_married: 27_220_000,
    estate_top_rate_pct: 40,
  },
  {
    scenario_id: 'sunset_2026',
    estate_exemption_individual: 7_000_000,
    estate_exemption_married: 14_000_000,
    estate_top_rate_pct: 40,
  },
]

export type MyEstateStrategyHorizonsResult = ReturnType<typeof buildStrategyHorizons>

export function buildStrategyHorizons(input: BuildHorizonsInput): {
  today: StrategyHorizonColumn
  tenYear: StrategyHorizonColumn
  atDeath: StrategyHorizonColumn
  showProjectionMismatchNote: boolean
  grossAtDeathByLongevity: number
  grossAtDeathFinalRow: number
} {
  const {
    currentYear,
    currentMonthYearLabel,
    liveNetWorth,
    household,
    federalConfigs: federalConfigsRaw,
    scenarioRows,
    survivorFirstName,
    longevityAge,
  } = input

  const federalConfigs =
    federalConfigsRaw.length > 0 ? federalConfigsRaw : FALLBACK_FEDERAL_CONFIGS

  const hasSpouse = household.has_spouse ?? false
  const fs = household.filing_status
  const statePrimary = household.state_primary

  const rows = scenarioRows ?? []
  const hasBaseCase = rows.length > 0

  const y10 = hasBaseCase ? findTenYearRow(rows, currentYear) : undefined
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

  const todayTax = computeColumnTaxes({
    grossEstate: liveNetWorth,
    calendarYear: currentYear,
    statePrimary,
    filingStatus: fs,
    hasSpouse,
    federalConfigs,
  })

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
  }

  const tenYearYear = currentYear + 10
  const tenYearGross = y10 ? grossEstateFromRow(y10) : null
  const tenYearTax =
    tenYearGross !== null
      ? computeColumnTaxes({
          grossEstate: tenYearGross,
          calendarYear: tenYearYear,
          statePrimary,
          filingStatus: fs,
          hasSpouse,
          federalConfigs,
        })
      : null

  const tenYear: StrategyHorizonColumn = hasBaseCase
    ? {
        headerTitle: 'In 10 Years',
        headerClassName: 'bg-blue-600 text-white',
        narrative: `Your projected estate in ${tenYearYear}. All figures are estimates.`,
        grossEstate: tenYearGross,
        federalExemption: tenYearTax?.federalExemption ?? null,
        federalExposure: tenYearTax?.federalExposure ?? null,
        federalTaxEstimate: tenYearTax?.federalTax ?? null,
        stateExposure: tenYearTax?.stateExposure ?? null,
        totalTaxLiability: tenYearTax?.totalTax ?? null,
        isPlaceholder: !y10,
        showGenerateCta: false,
        showMissingRowNote: !y10,
        missingRowCalendarYear: tenYearYear,
      }
    : {
        headerTitle: 'In 10 Years',
        headerClassName: 'bg-blue-600 text-white',
        narrative: `Your projected estate in ${tenYearYear}. All figures are estimates.`,
        grossEstate: null,
        federalExemption: null,
        federalExposure: null,
        federalTaxEstimate: null,
        stateExposure: null,
        totalTaxLiability: null,
        isPlaceholder: true,
        showGenerateCta: true,
      }

  const atDeathCalendarYear = atDeathRow?.year ?? currentYear
  const atDeathGross = atDeathRow ? grossEstateFromRow(atDeathRow) : null
  const atDeathTax =
    atDeathGross !== null && hasBaseCase
      ? computeColumnTaxes({
          grossEstate: atDeathGross,
          calendarYear: atDeathCalendarYear,
          statePrimary,
          filingStatus: fs,
          hasSpouse,
          federalConfigs,
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
    atDeath,
    showProjectionMismatchNote,
    grossAtDeathByLongevity,
    grossAtDeathFinalRow,
  }
}
