import { sha256Hex } from '@/lib/monte-carlo/sha256Hex'

export type ProjectionInputsHashPayload = {
  grossEstate: number
  state_primary: string | null
  filing_status: string | null
  has_spouse: boolean | null
  person1_birth_year: number | null
  person2_birth_year: number | null
  person1_longevity_age: number | null
  person2_longevity_age: number | null
  person1_retirement_age: number | null
  growth_rate_accumulation: number | string | null
  hasBypassTrust: boolean
  base_case_scenario_id: string | null
}

export function buildProjectionInputsHashPayload(input: {
  grossEstate: number
  state_primary?: string | null
  filing_status?: string | null
  has_spouse?: boolean | null
  person1_birth_year?: number | null
  person2_birth_year?: number | null
  person1_longevity_age?: number | null
  person2_longevity_age?: number | null
  person1_retirement_age?: number | null
  growth_rate_accumulation?: number | string | null
  hasBypassTrust: boolean
  base_case_scenario_id?: string | null
}): ProjectionInputsHashPayload {
  return {
    grossEstate: Number(input.grossEstate ?? 0),
    state_primary: input.state_primary ?? null,
    filing_status: input.filing_status ?? null,
    has_spouse: input.has_spouse ?? null,
    person1_birth_year: input.person1_birth_year ?? null,
    person2_birth_year: input.person2_birth_year ?? null,
    person1_longevity_age: input.person1_longevity_age ?? null,
    person2_longevity_age: input.person2_longevity_age ?? null,
    person1_retirement_age: input.person1_retirement_age ?? null,
    growth_rate_accumulation: input.growth_rate_accumulation ?? null,
    hasBypassTrust: input.hasBypassTrust,
    base_case_scenario_id: input.base_case_scenario_id ?? null,
  }
}

/** Deterministic SHA-256 over sorted JSON keys. */
export async function computeProjectionInputsHash(
  payload: ProjectionInputsHashPayload,
): Promise<string> {
  const sorted = Object.keys(payload)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = payload[key as keyof ProjectionInputsHashPayload]
      return acc
    }, {})
  return sha256Hex(JSON.stringify(sorted))
}
