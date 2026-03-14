'use server'

import { runProjection } from '@/lib/calculations/projection'
import type { ProjectionYear } from '@/lib/calculations/projection'

export type ScenarioAssumptions = {
  retirement_age?: number | null
  investment_return_pct?: number | null
  ss_claiming_age?: number | null
  state_primary?: string | null
}

export async function runScenarioProjection(
  householdId: string,
  options: {
    start_year?: number
    end_year?: number
    person1_birth_year?: number
  },
  assumptions: ScenarioAssumptions
): Promise<{ data: ProjectionYear[] | null; error: string | null }> {
  try {
    const growthRate =
      assumptions.investment_return_pct != null
        ? assumptions.investment_return_pct / 100
        : undefined
    const statePrimary =
      assumptions.state_primary !== undefined && assumptions.state_primary !== ''
        ? String(assumptions.state_primary).toUpperCase().slice(0, 2)
        : undefined
    const data = await runProjection(householdId, {
      ...options,
      growth_rate: growthRate,
      state_primary: statePrimary ?? null,
      state_compare: null,
      person1_retirement_age: assumptions.retirement_age ?? undefined,
      person1_ss_claiming_age: assumptions.ss_claiming_age ?? undefined,
    })
    return { data, error: null }
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Failed to run projection'
    return { data: null, error }
  }
}
