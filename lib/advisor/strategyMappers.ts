import { displayPersonFirstName } from '@/lib/display-person-name'
import {
  buildStrategyHorizons,
  longevityAndSurvivor,
  type MyEstateStrategyHorizonsResult,
} from '@/lib/my-estate-strategy/horizonSnapshots'
import type { AnnualOutput } from '@/lib/types/projection-scenario'
import type { StateBracket } from '@/lib/calculations/stateEstateTax'

type HouseholdLike = {
  has_spouse: boolean
  state_primary: string | null
  filing_status: string | null
  person1_first_name: string | null
  person1_last_name: string | null
  person2_first_name: string | null
  person2_last_name: string | null
  person1_birth_year: number | null
  person2_birth_year: number | null
  person1_longevity_age: number | null
  person2_longevity_age: number | null
}

export function buildAdvisorStrategyViewModels(params: {
  currentYear: number
  household: HouseholdLike
  stateBrackets: StateBracket[]
  estateCompositionGrossEstate: number
  scenario: Record<string, unknown> | null
  scenarioOutputs: Array<Record<string, unknown>>
  scenarioOutputsSecondDeath: Array<Record<string, unknown>>
  latestOutput: Record<string, unknown> | null
  assumptionSnapshot: Record<string, unknown>
  strategyLineItems: Array<{
    source_role: string
    amount: number
    sign: number
    confidence_level: 'certain' | 'probable' | 'illustrative'
    effective_year: number | null
    consumer_accepted: boolean
    consumer_rejected: boolean
  }>
}) {
  const currentMonthYearLabel = new Date().toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const advisorScenarioOutputs = (
    params.scenario && Array.isArray(params.scenario.outputs_s1_first) && params.scenario.outputs_s1_first.length > 0
      ? params.scenario.outputs_s1_first
      : params.scenario && Array.isArray(params.scenario.outputs)
        ? params.scenario.outputs
        : []
  ) as AnnualOutput[]

  const { longevityAge, survivorIsPerson1 } = longevityAndSurvivor({
    hasSpouse: params.household.has_spouse ?? false,
    person1Longevity: params.household.person1_longevity_age ?? null,
    person2Longevity: params.household.person2_longevity_age ?? null,
  })

  const survivorFirstName = !(params.household.has_spouse ?? false)
    ? displayPersonFirstName(
        [params.household.person1_first_name, params.household.person1_last_name].filter(Boolean).join(' ').trim() || null,
      )
    : survivorIsPerson1
      ? displayPersonFirstName(
          [params.household.person1_first_name, params.household.person1_last_name].filter(Boolean).join(' ').trim() || null,
        )
      : displayPersonFirstName(
          [params.household.person2_first_name, params.household.person2_last_name].filter(Boolean).join(' ').trim() || null,
        )

  const activeRows = (params.strategyLineItems ?? []).filter((item) => !item.consumer_rejected)
  const actualStrategyLineItems = activeRows
    .filter((item) => item.source_role === 'consumer' || (item.source_role === 'advisor' && item.consumer_accepted))
    .map((item) => ({
      amount: Math.abs(Number(item.amount ?? 0)),
      confidence_level: item.confidence_level,
      effective_year: item.effective_year,
      is_active: true,
      sign: typeof item.sign === 'number' ? item.sign : -1,
    }))
  const pendingAdvisorLineItems = activeRows
    .filter((item) => item.source_role === 'advisor' && !item.consumer_accepted)
    .map((item) => ({
      amount: Math.abs(Number(item.amount ?? 0)),
      confidence_level: item.confidence_level,
      effective_year: item.effective_year,
      is_active: true,
      sign: typeof item.sign === 'number' ? item.sign : -1,
    }))
  const projectedStrategyLineItems = [...actualStrategyLineItems, ...pendingAdvisorLineItems]

  const advisorHorizons: MyEstateStrategyHorizonsResult = buildStrategyHorizons({
    currentYear: params.currentYear,
    currentMonthYearLabel,
    liveNetWorth: Number(params.estateCompositionGrossEstate ?? 0),
    stateBrackets: params.stateBrackets,
    household: {
      state_primary: params.household.state_primary,
      filing_status: params.household.filing_status,
      has_spouse: params.household.has_spouse ?? false,
      person1_name: params.household.person1_first_name,
      person2_name: params.household.person2_first_name,
      person1_birth_year: params.household.person1_birth_year,
      person2_birth_year: params.household.person2_birth_year,
      person1_longevity_age: params.household.person1_longevity_age ?? null,
      person2_longevity_age: params.household.person2_longevity_age ?? null,
    },
    scenarioRows: advisorScenarioOutputs.length > 0 ? advisorScenarioOutputs : null,
    survivorFirstName,
    longevityAge,
    strategyLineItems: actualStrategyLineItems,
  })

  const advisorHorizonsProjected: MyEstateStrategyHorizonsResult = buildStrategyHorizons({
    currentYear: params.currentYear,
    currentMonthYearLabel,
    liveNetWorth: Number(params.estateCompositionGrossEstate ?? 0),
    stateBrackets: params.stateBrackets,
    household: {
      state_primary: params.household.state_primary,
      filing_status: params.household.filing_status,
      has_spouse: params.household.has_spouse ?? false,
      person1_name: params.household.person1_first_name,
      person2_name: params.household.person2_first_name,
      person1_birth_year: params.household.person1_birth_year,
      person2_birth_year: params.household.person2_birth_year,
      person1_longevity_age: params.household.person1_longevity_age ?? null,
      person2_longevity_age: params.household.person2_longevity_age ?? null,
    },
    scenarioRows: advisorScenarioOutputs.length > 0 ? advisorScenarioOutputs : null,
    survivorFirstName,
    longevityAge,
    strategyLineItems: projectedStrategyLineItems,
  })

  const scenarioForStrategy = params.scenario
    ? {
        id: String(params.scenario.id ?? ''),
        gross_estate: Number(
          params.estateCompositionGrossEstate ?? params.latestOutput?.estate_incl_home ?? 0,
        ),
        federal_exemption: Number(params.assumptionSnapshot.estate_exemption_individual ?? 15_000_000),
        annual_rmd: Number(params.latestOutput?.income_rmd ?? 0),
        pre_ira_balance: Number(params.latestOutput?.assets_tax_deferred ?? 0),
        roth_balance: Number(params.latestOutput?.assets_roth ?? 0),
        estimated_federal_tax: Number(
          params.latestOutput?.estate_tax_federal ??
            params.latestOutput?.federal_tax ??
            params.latestOutput?.federal_estate_tax ??
            0,
        ),
        law_scenario: 'current_law' as const,
      }
    : null

  const projectionRowsDomicile = params.scenarioOutputsSecondDeath.map((row) => ({
    year: Number(row.year ?? 0),
    gross_estate: Number(row.estate_incl_home ?? row.gross_estate ?? 0),
  }))

  return {
    advisorHorizons,
    advisorHorizonsProjected,
    scenarioForStrategy,
    projectionRowsDomicile,
    strategySetSummary: {
      actualCount: actualStrategyLineItems.length,
      pendingAdvisorCount: pendingAdvisorLineItems.length,
      projectedCount: projectedStrategyLineItems.length,
    },
  }
}
