// lib/calculations/estate-tax-projection.ts
// Federal estate tax engine wired to federal_tax_config (Sprint 59)
// Reads brackets and exemptions from DB — no hardcoded tax constants.

// Scenario IDs changed Session 20 to reflect OBBBA 2026:
// - 'current_law_extended' -> 'current_law'  (OBBBA made it permanent)
// - 'sunset_2026'          -> REMOVED        (OBBBA eliminated the sunset)
// - 'legislative_change'   -> REMOVED        (was a placeholder, not used)
// Federal exemption numbers still come from the federal_tax_config DB row.
// The single source of truth for OBBBA constants is lib/tax/estate-tax-constants.ts.

import type { YearRow } from '@/lib/calculations/projection-complete'

export type StateBracket = {
  min_amount: number
  max_amount: number
  rate_pct: number
  exemption_amount: number
}

export type TaxScenarioId =
  | 'current_law'
  | 'no_exemption'

export type FederalTaxConfig = {
  scenario_id: TaxScenarioId
  estate_exemption_individual: number
  estate_exemption_married: number
  estate_top_rate_pct: number
  annual_gift_exclusion: number
}

export type EstateTaxYearRow = YearRow & {
  estate_tax_federal: number
  estate_tax_state: number
  net_to_heirs: number
  dsue_available: number // portability carryover
  exemption_used: number
  taxable_estate: number
}

export type DeathSequenceOutput = {
  sequence: 'S1_first' | 'S2_first' | 'single'
  death_year_s1: number | null // year person 1 dies (their longevity year)
  death_year_s2: number | null
  dsue_amount: number // DSUE carried from S1 to S2
  rows: EstateTaxYearRow[]
  // Summary at final death
  gross_estate_at_death: number
  estate_tax_federal: number
  estate_tax_state: number
  net_to_heirs: number
}

// -- Main engine --------------------------------------------------------------

export function computeEstateTaxProjection(
  projectionRows: YearRow[],
  config: FederalTaxConfig,
  filingStatus: string,
  hasSpouse: boolean,
  person1BirthYear: number,
  person1LongevityAge: number,
  person2BirthYear: number | null,
  person2LongevityAge: number | null,
  stateBrackets: StateBracket[],
): {
  s1_first: DeathSequenceOutput
  s2_first: DeathSequenceOutput | null
} {
  const isMarried = hasSpouse && filingStatus === 'mfj'
  const exemptionIndividual = config.estate_exemption_individual
  const exemptionMarried = config.estate_exemption_married
  const topRate = config.estate_top_rate_pct / 100

  // Death years
  const deathYearP1 = person1BirthYear + person1LongevityAge
  const deathYearP2 =
    person2BirthYear && person2LongevityAge
      ? person2BirthYear + person2LongevityAge
      : null

  // -- S1 first sequence (person 1 dies first) ------------------------------
  const s1First = computeSequence({
    rows: projectionRows,
    firstDeathYear: deathYearP1,
    secondDeathYear: deathYearP2,
    exemptionIndividual,
    exemptionMarried,
    topRate,
    isMarried,
    stateBrackets,
    sequence: 'S1_first',
  })

  // -- S2 first sequence (person 2 dies first) -- only for married ----------
  const s2First =
    isMarried && deathYearP2
      ? computeSequence({
          rows: projectionRows,
          firstDeathYear: deathYearP2,
          secondDeathYear: deathYearP1,
          exemptionIndividual,
          exemptionMarried,
          topRate,
          isMarried,
          stateBrackets,
          sequence: 'S2_first',
        })
      : null

  return { s1_first: s1First, s2_first: s2First }
}

function computeSequence({
  rows,
  firstDeathYear,
  secondDeathYear,
  exemptionIndividual,
  exemptionMarried,
  topRate,
  isMarried,
  stateBrackets,
  sequence,
}: {
  rows: YearRow[]
  firstDeathYear: number
  secondDeathYear: number | null
  exemptionIndividual: number
  exemptionMarried: number
  topRate: number
  isMarried: boolean
  stateBrackets: StateBracket[]
  sequence: 'S1_first' | 'S2_first' | 'single'
}): DeathSequenceOutput {
  let dsue_amount = 0
  const outputRows: EstateTaxYearRow[] = []

  for (const row of rows) {
    const grossEstate = row.estate_incl_home
    let estate_tax_federal = 0
    let estate_tax_state = 0
    let taxable_estate = 0
    let exemption_used = 0
    const dsue_available = dsue_amount

    // Only compute estate tax at death years
    if (row.year === firstDeathYear) {
      if (isMarried && secondDeathYear) {
        // Marital deduction - entire estate passes to surviving spouse tax-free.
        // No federal or state estate tax at first death for married couples.
        // DSUE: full individual exemption is portable to survivor.
        dsue_amount = exemptionIndividual
        estate_tax_federal = 0
        estate_tax_state = 0
        taxable_estate = 0
        exemption_used = 0
      } else {
        // Single or widowed - estate tax applies at first (only) death
        const exemption = exemptionIndividual + dsue_amount
        taxable_estate = Math.max(0, grossEstate - exemption)
        estate_tax_federal = computeProgressiveEstateTax(taxable_estate, topRate)
        estate_tax_state =
          taxable_estate > 0
            ? computeStateEstateTaxFromBrackets(grossEstate, stateBrackets)
            : 0
        exemption_used = Math.min(grossEstate, exemption)
      }
    } else if (secondDeathYear && row.year === secondDeathYear) {
      // Second death - DSUE from first spouse added to survivor's exemption.
      // Both federal and state estate tax apply against the combined estate.
      const exemption = exemptionIndividual + dsue_amount
      taxable_estate = Math.max(0, grossEstate - exemption)
      estate_tax_federal = computeProgressiveEstateTax(taxable_estate, topRate)
      estate_tax_state =
        taxable_estate > 0
          ? computeStateEstateTaxFromBrackets(grossEstate, stateBrackets)
          : 0
      exemption_used = Math.min(grossEstate, exemption)
    }

    const net_to_heirs = Math.max(
      0,
      grossEstate - estate_tax_federal - estate_tax_state,
    )

    outputRows.push({
      ...row,
      estate_tax_federal: Math.round(estate_tax_federal),
      estate_tax_state: Math.round(estate_tax_state),
      net_to_heirs: Math.round(net_to_heirs),
      dsue_available,
      exemption_used: Math.round(exemption_used),
      taxable_estate: Math.round(taxable_estate),
    })
  }

  // Summary at final death
  const finalDeathYear = secondDeathYear ?? firstDeathYear
  const finalRow =
    outputRows.find(r => r.year === finalDeathYear) ?? outputRows[outputRows.length - 1]

  return {
    sequence,
    death_year_s1: sequence === 'S1_first' ? firstDeathYear : secondDeathYear,
    death_year_s2: sequence === 'S1_first' ? secondDeathYear : firstDeathYear,
    dsue_amount,
    rows: outputRows,
    gross_estate_at_death: finalRow?.estate_incl_home ?? 0,
    estate_tax_federal: finalRow?.estate_tax_federal ?? 0,
    estate_tax_state: finalRow?.estate_tax_state ?? 0,
    net_to_heirs: finalRow?.net_to_heirs ?? 0,
  }
}

// Simple progressive estate tax -- top rate applies above exemption
// Federal estate tax has a flat 40% rate above the exemption in practice
function computeProgressiveEstateTax(taxableEstate: number, topRate: number): number {
  if (taxableEstate <= 0) return 0
  // Federal estate tax: graduated brackets up to top rate
  // Simplified: use the existing computeFederalEstateTax function brackets
  // For the projection engine we use the top rate directly since
  // the full bracket table is applied in the estate-tax page
  return Math.round(taxableEstate * topRate)
}

export function computeStateEstateTaxFromBrackets(
  grossEstate: number,
  brackets: StateBracket[],
): number {
  if (brackets.length === 0) return 0
  const exemption = brackets[0].exemption_amount ?? 0
  const taxable = Math.max(0, grossEstate - exemption)
  if (taxable <= 0) return 0
  let tax = 0
  for (const bracket of brackets) {
    const bracketMin = bracket.min_amount
    const bracketMax = bracket.max_amount >= 9_999_999_999 ? Infinity : bracket.max_amount
    if (taxable <= bracketMin) break
    const inBracket = Math.min(taxable, bracketMax) - bracketMin
    if (inBracket > 0) tax += inBracket * (bracket.rate_pct / 100)
  }
  return Math.round(tax)
}

// -- Scenario comparison ------------------------------------------------------

export type ScenarioComparison = {
  scenario_id: TaxScenarioId
  label: string
  gross_estate: number
  estate_tax_federal: number
  estate_tax_state: number
  net_to_heirs: number
  cost_of_inaction: number // vs best-case scenario
}

export function buildScenarioComparison(
  sequences: Record<TaxScenarioId, DeathSequenceOutput>,
): ScenarioComparison[] {
  const results = Object.entries(sequences).map(([id, seq]) => ({
    scenario_id: id as TaxScenarioId,
    label: scenarioLabel(id as TaxScenarioId),
    gross_estate: seq.gross_estate_at_death,
    estate_tax_federal: seq.estate_tax_federal,
    estate_tax_state: seq.estate_tax_state,
    net_to_heirs: seq.net_to_heirs,
    cost_of_inaction: 0,
  }))

  // Cost of inaction = tax in this scenario minus tax in best scenario
  const minTax = Math.min(
    ...results.map(r => r.estate_tax_federal + r.estate_tax_state),
  )
  return results.map(r => ({
    ...r,
    cost_of_inaction: Math.max(
      0,
      r.estate_tax_federal + r.estate_tax_state - minTax,
    ),
  }))
}

function scenarioLabel(id: TaxScenarioId): string {
  const labels: Record<TaxScenarioId, string> = {
    current_law: 'Current Law',
    no_exemption: 'No Exemption',
  }
  return labels[id]
}
