// Sprint 65 - Domicile Schedule + Multi-State Transition Engine

import {
  calculateStateEstateTax,
  type DbStateExemption,
  type StateTaxCode,
} from './stateRegistry'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DomicileScheduleRow {
  id?:                string
  household_id:       string
  effective_year:     number
  state_code:         string
  is_established:     boolean
  establishment_date?: string | null
  notes?:             string | null
}

export interface DomicileTransition {
  from_state:     StateTaxCode
  to_state:       StateTaxCode
  transition_year: number
  cliff_year?:    number   // year domicile is firmly established (typically +2)
}

export interface MoveBreakevenResult {
  from_state:          StateTaxCode
  to_state:            StateTaxCode
  transition_year:     number
  crossover_year:      number | null   // year cumulative savings exceed move costs
  never_breaks_even:   boolean
  year_by_year:        MoveBreakevenRow[]
  total_savings_at_death: number
  recommendation:      string
}

export interface MoveBreakevenRow {
  year:                  number
  domicile:              StateTaxCode
  gross_estate:          number
  state_tax:             number
  cumulative_tax_savings: number
  net_after_move_costs:  number
}

// ── getDomicileForYear ────────────────────────────────────────────────────────

/**
 * Returns the effective domicile state for a given year, based on the
 * domicile_schedule rows. Handles cliff logic: if a transition is in progress,
 * the new state is not yet established until is_established = true.
 */
export function getDomicileForYear(
  schedule: DomicileScheduleRow[],
  year: number
): StateTaxCode {
  if (!schedule || schedule.length === 0) return 'other'

  // Sort ascending by effective_year
  const sorted = [...schedule].sort((a, b) => a.effective_year - b.effective_year)

  // Find the most recent row on or before the target year
  const applicable = sorted.filter(r => r.effective_year <= year)

  if (applicable.length === 0) {
    // Before any scheduled domicile — use earliest
    return (sorted[0].state_code as StateTaxCode) ?? 'other'
  }

  const current = applicable[applicable.length - 1]

  // If not yet established (cliff not resolved), use prior domicile
  if (!current.is_established) {
    const prior = applicable.slice(0, -1)
    if (prior.length > 0) {
      return (prior[prior.length - 1].state_code as StateTaxCode) ?? 'other'
    }
  }

  return (current.state_code as StateTaxCode) ?? 'other'
}

// ── calculateMoveBreakeven ────────────────────────────────────────────────────

/**
 * Calculates the year-by-year estate tax savings from moving domicile,
 * and finds the crossover year where cumulative savings exceed move costs.
 *
 * Move costs are estimated (attorney fees, registration, travel, etc.)
 * Defaults to $25,000 for a typical WA-to-AZ move.
 */
export function calculateMoveBreakeven(params: {
  grossEstateByYear:  Record<number, number>
  fromState:          StateTaxCode
  toState:            StateTaxCode
  transitionYear:     number
  federalExemption?:  number
  dsue?:              number
  dbExemptions?:      DbStateExemption[]
  estimatedMoveCost?: number
  deathYear?:         number
}): MoveBreakevenResult {
  const {
    grossEstateByYear,
    fromState,
    toState,
    transitionYear,
    federalExemption,
    dsue = 0,
    dbExemptions,
    estimatedMoveCost = 25_000,
  } = params

  const years = Object.keys(grossEstateByYear).map(Number).sort((a, b) => a - b)
  const rows: MoveBreakevenRow[] = []
  let crossoverYear: number | null = null
  let cumulativeSavings = -estimatedMoveCost  // start negative (move costs)

  for (const year of years) {
    const grossEstate = grossEstateByYear[year]
    const domicile = year < transitionYear ? fromState : toState

    const taxResult = calculateStateEstateTax({
      grossEstate,
      stateCode: domicile,
      year,
      federalExemption,
      dsue,
      dbExemptions,
    })

    // What would tax have been without moving?
    const noMoveTax = calculateStateEstateTax({
      grossEstate,
      stateCode: fromState,
      year,
      federalExemption,
      dsue,
      dbExemptions,
    })

    const annualSaving = noMoveTax.stateTax - taxResult.stateTax
    cumulativeSavings += annualSaving

    rows.push({
      year,
      domicile,
      gross_estate:           grossEstate,
      state_tax:              taxResult.stateTax,
      cumulative_tax_savings: Math.round(cumulativeSavings),
      net_after_move_costs:   Math.round(cumulativeSavings),
    })

    // First year where cumulative savings turn positive = crossover
    if (!crossoverYear && cumulativeSavings > 0 && year >= transitionYear) {
      crossoverYear = year
    }
  }

  const lastRow = rows[rows.length - 1]
  const totalSavingsAtDeath = lastRow?.cumulative_tax_savings ?? 0
  const neverBreaksEven = crossoverYear === null && totalSavingsAtDeath <= 0

  let recommendation: string
  if (neverBreaksEven) {
    recommendation = `Moving from ${fromState} to ${toState} does not break even within the projection window. The estate may be below the ${fromState} exemption threshold.`
  } else if (crossoverYear) {
    recommendation = `Moving from ${fromState} to ${toState} breaks even in ${crossoverYear}. Estimated lifetime savings: ${totalSavingsAtDeath.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}.`
  } else {
    recommendation = `Move savings are projected but crossover year is beyond the projection window.`
  }

  return {
    from_state:             fromState,
    to_state:               toState,
    transition_year:        transitionYear,
    crossover_year:         crossoverYear,
    never_breaks_even:      neverBreaksEven,
    year_by_year:           rows,
    total_savings_at_death: totalSavingsAtDeath,
    recommendation,
  }
}

// ── Domicile establishment checklist seed data ────────────────────────────────

export interface ChecklistItem {
  item_key:    string
  category:    string
  label:       string
  description: string
  priority:    'critical' | 'standard'
}

export const DOMICILE_CHECKLIST: Record<string, ChecklistItem[]> = {
  AZ: [
    { item_key: 'drivers_license',       category: 'government_records',  label: 'Get AZ driver\'s license',             description: 'Obtain an Arizona driver\'s license within 30 days of establishing residence.',             priority: 'critical' },
    { item_key: 'voter_registration',    category: 'government_records',  label: 'Register to vote in AZ',               description: 'Register to vote in Arizona. This is one of the strongest indicators of domicile.',       priority: 'critical' },
    { item_key: 'vehicle_registration',  category: 'government_records',  label: 'Register vehicles in AZ',              description: 'Transfer vehicle registrations from WA to AZ.',                                         priority: 'standard' },
    { item_key: 'homestead_exemption',   category: 'financial',           label: 'Apply for homestead exemption in AZ',  description: 'If available, apply for the homestead exemption in AZ to reinforce domicile intent.',      priority: 'standard' },
    { item_key: 'bank_accounts',         category: 'financial',           label: 'Open AZ bank accounts',                description: 'Open checking/savings accounts at an Arizona bank branch.',                             priority: 'standard' },
    { item_key: 'estate_docs_updated',   category: 'legal',               label: 'Update estate docs to AZ domicile',    description: 'Have attorney update will, trust, and POA to declare AZ as state of domicile.',           priority: 'critical' },
    { item_key: 'tax_return_filed',      category: 'financial',           label: 'File taxes as AZ resident',            description: 'File state tax return as an Arizona resident for the transition year.',                   priority: 'critical' },
    { item_key: 'local_affiliations',    category: 'social_ties',         label: 'Join local organizations in AZ',       description: 'Membership in clubs, religious groups, or charities in AZ supports domicile intent.',    priority: 'standard' },
    { item_key: 'primary_home_az',       category: 'real_estate',         label: 'Establish primary home in AZ',         description: 'Ensure the AZ property is titled and used as primary residence.',                        priority: 'critical' },
    { item_key: 'wa_ties_reduced',       category: 'social_ties',         label: 'Reduce WA ties',                       description: 'Limit time spent in WA. Document days in each state. Target < 183 days in WA.',         priority: 'critical' },
  ],
  FL: [
    { item_key: 'drivers_license',       category: 'government_records',  label: 'Get FL driver\'s license',             description: 'Obtain a Florida driver\'s license.',                                                   priority: 'critical' },
    { item_key: 'voter_registration',    category: 'government_records',  label: 'Register to vote in FL',               description: 'Register to vote in Florida.',                                                          priority: 'critical' },
    { item_key: 'declaration_domicile',  category: 'legal',               label: 'File Declaration of Domicile',         description: 'File a Declaration of Domicile with the Florida county clerk.',                          priority: 'critical' },
    { item_key: 'homestead_exemption',   category: 'real_estate',         label: 'Apply for FL homestead exemption',     description: 'Apply for Florida homestead exemption — provides property tax savings and creditor protection.', priority: 'critical' },
    { item_key: 'estate_docs_updated',   category: 'legal',               label: 'Update estate docs to FL domicile',    description: 'Have attorney update will, trust, and POA to declare FL as state of domicile.',           priority: 'critical' },
    { item_key: 'tax_return_filed',      category: 'financial',           label: 'File taxes as FL resident',            description: 'File as a Florida resident (no state income tax return required).',                      priority: 'standard' },
    { item_key: 'wa_ties_reduced',       category: 'social_ties',         label: 'Reduce prior state ties',              description: 'Limit time spent in prior state. Document days carefully.',                              priority: 'critical' },
  ],
}

// Default checklist for states without specific items
export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { item_key: 'drivers_license',      category: 'government_records', label: 'Get driver\'s license in new state',    description: 'Obtain a driver\'s license in the new domicile state.',                     priority: 'critical' },
  { item_key: 'voter_registration',   category: 'government_records', label: 'Register to vote in new state',         description: 'Register to vote in the new domicile state.',                               priority: 'critical' },
  { item_key: 'estate_docs_updated',  category: 'legal',              label: 'Update estate docs to new domicile',    description: 'Have attorney update estate documents to reflect new state of domicile.',  priority: 'critical' },
  { item_key: 'tax_return_filed',     category: 'financial',          label: 'File taxes as new state resident',      description: 'File state tax returns as a resident of the new domicile state.',          priority: 'critical' },
  { item_key: 'prior_ties_reduced',   category: 'social_ties',        label: 'Reduce prior state ties',               description: 'Limit time in prior state and document days spent in each state.',        priority: 'critical' },
]

export function getChecklistForState(stateCode: string): ChecklistItem[] {
  return DOMICILE_CHECKLIST[stateCode] ?? DEFAULT_CHECKLIST
}
