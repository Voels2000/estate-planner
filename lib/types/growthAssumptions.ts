export interface GrowthAssumptions {
  /** Annual growth rate for real estate holdings (default 4.5%) */
  real_estate: number
  /** Annual growth rate for business interests (default 7.0%) */
  business: number
}

export const GROWTH_ASSUMPTION_DEFAULTS: GrowthAssumptions = {
  real_estate: 4.5,
  business: 7.0,
}

export const GROWTH_ASSUMPTION_RANGES = {
  real_estate: { min: 0, max: 15, step: 0.5 },
  business: { min: 0, max: 25, step: 0.5 },
  financial: { min: 0, max: 20, step: 0.5 },
} as const

export const GROWTH_ASSUMPTION_LABELS: Record<keyof GrowthAssumptions, {
  label: string
  description: string
  hint: string
}> = {
  real_estate: {
    label: 'Real Estate Appreciation',
    description: 'Annual appreciation rate for all real estate holdings',
    hint: 'National average: 3–5%. Adjust for your specific market. Does not affect rental income.',
  },
  business: {
    label: 'Business Growth Rate',
    description: 'Annual growth rate applied to business interest valuations',
    hint: 'Based on your business revenue and profit growth. Consult your accountant for a precise estimate.',
  },
}

/** Parse from household JSON, filling defaults for missing keys */
export function parseGrowthAssumptions(raw: unknown): GrowthAssumptions {
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as Partial<GrowthAssumptions>
  return {
    real_estate: parsed.real_estate ?? GROWTH_ASSUMPTION_DEFAULTS.real_estate,
    business: parsed.business ?? GROWTH_ASSUMPTION_DEFAULTS.business,
  }
}

/** Merge household JSON, engine input, scenario overrides, and advisor overrides (priority L→R). */
export function resolveGrowthAssumptions(
  householdRaw: unknown,
  options?: {
    input?: Partial<GrowthAssumptions>
    scenarioOverrides?: Partial<GrowthAssumptions>
    advisorOverrides?: Partial<GrowthAssumptions>
  },
): GrowthAssumptions {
  const base = parseGrowthAssumptions(householdRaw)
  const { input, scenarioOverrides, advisorOverrides } = options ?? {}
  return {
    real_estate:
      advisorOverrides?.real_estate ??
      scenarioOverrides?.real_estate ??
      input?.real_estate ??
      base.real_estate,
    business:
      advisorOverrides?.business ??
      scenarioOverrides?.business ??
      input?.business ??
      base.business,
  }
}
