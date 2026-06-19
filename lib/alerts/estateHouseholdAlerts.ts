import { computeBusinessOwnershipValue } from '@/lib/my-estate-strategy/horizonSnapshots'

export const LARGE_ESTATE_THRESHOLD_SINGLE = 10_000_000
export const LARGE_ESTATE_THRESHOLD_MFJ = 20_000_000
export const ILIT_GAP_DOLLARS = 250_000
export const LARGE_ESTATE_NO_TRUST_THRESHOLD = 1_000_000
export const GRAT_BUSINESS_THRESHOLD = 500_000
export const ROTH_PRE_TAX_THRESHOLD = 500_000

const PRE_TAX_RETIREMENT_TYPES = new Set(['traditional_401k', 'traditional_ira', '403b'])

const BUSINESS_ASSET_TYPES = new Set([
  'business_interest',
  'private_equity',
  'closely_held_business',
])

export type EstateHouseholdAlertContext = {
  household: Record<string, unknown>
  assets: Record<string, unknown>[]
  insurancePolicies: { death_benefit?: number | null; is_ilit?: boolean | null }[]
  realEstateRows: { current_value?: number | null }[]
  estateHealthCheck: { has_trust?: boolean | null } | null
  businesses?: { estimated_value?: unknown; ownership_pct?: unknown }[]
  businessInterests?: {
    fmv_estimated?: unknown
    total_entity_value?: unknown
    ownership_pct?: unknown
  }[]
  strategyLineItems?: { strategy_source?: string | null; is_active?: boolean | null }[]
}

export type EstateHouseholdAlertRule = {
  id: string
  fire: boolean
  alertType: 'info' | 'warning' | 'action_required'
  severity: 'low' | 'medium' | 'high'
  title: string
  description: string
  linkPath: string | null
  context: Record<string, unknown>
}

export function derivePreTaxRetirementBalance(assets: Record<string, unknown>[]): number {
  return assets
    .filter((a) => PRE_TAX_RETIREMENT_TYPES.has(String(a.type ?? '').toLowerCase()))
    .reduce((s, a) => s + Number(a.value ?? 0), 0)
}

export function deriveBusinessInterestValue(
  assets: Record<string, unknown>[],
  businesses: EstateHouseholdAlertContext['businesses'] = [],
  businessInterests: EstateHouseholdAlertContext['businessInterests'] = [],
): number {
  const fromAssets = assets
    .filter((a) => BUSINESS_ASSET_TYPES.has(String(a.type ?? '').toLowerCase()))
    .reduce((s, a) => s + Number(a.value ?? 0), 0)
  return fromAssets + computeBusinessOwnershipValue(businesses ?? [], businessInterests ?? [])
}

export function hasActiveGratStrategy(
  lineItems: EstateHouseholdAlertContext['strategyLineItems'] = [],
): boolean {
  return (lineItems ?? []).some(
    (li) => li.is_active !== false && String(li.strategy_source ?? '').toLowerCase() === 'grat',
  )
}

function largeEstateThreshold(filingStatus: string): number {
  return filingStatus === 'mfj' || filingStatus === 'married_joint'
    ? LARGE_ESTATE_THRESHOLD_MFJ
    : LARGE_ESTATE_THRESHOLD_SINGLE
}

/** Consumer household alerts (string rule ids; no DB alert_rules rows). */
export function buildEstateHouseholdAlertRules(
  ctx: EstateHouseholdAlertContext,
): EstateHouseholdAlertRule[] {
  const grossEstate =
    ctx.assets.reduce((s, a) => s + Number(a.value ?? 0), 0) +
    ctx.realEstateRows.reduce((s, r) => s + Number(r.current_value ?? 0), 0)

  const filingStatus = (ctx.household as { filing_status?: string }).filing_status ?? 'single'
  const largeEstateMin = largeEstateThreshold(filingStatus)
  const largeEstateSignal = grossEstate > largeEstateMin

  const lifeInsuranceOutsideIlit = ctx.insurancePolicies
    .filter((p) => !p.is_ilit)
    .reduce((s, p) => s + Number(p.death_benefit ?? 0), 0)

  const hasTrustOnFile = ctx.estateHealthCheck?.has_trust === true
  const hasGiftingProgram = Boolean(
    (ctx.household as { has_gifting_program?: boolean }).has_gifting_program,
  )
  const baseCaseId = (ctx.household as { base_case_scenario_id?: string | null })
    .base_case_scenario_id
  const hasEnteredAssets = ctx.assets.length > 0 || ctx.realEstateRows.length > 0

  const businessInterestValue = deriveBusinessInterestValue(
    ctx.assets,
    ctx.businesses,
    ctx.businessInterests,
  )
  const hasGratOnFile = hasActiveGratStrategy(ctx.strategyLineItems)
  const preTaxRetirementBalance = derivePreTaxRetirementBalance(ctx.assets)

  const businessRounded = Math.round(businessInterestValue).toLocaleString()
  const preTaxRounded = Math.round(preTaxRetirementBalance).toLocaleString()
  const grossRounded = Math.round(grossEstate).toLocaleString()
  const ilitRounded = Math.round(lifeInsuranceOutsideIlit).toLocaleString()

  return [
    {
      id: 'estate_ilit_gap',
      fire: lifeInsuranceOutsideIlit > ILIT_GAP_DOLLARS,
      alertType: lifeInsuranceOutsideIlit > 1_000_000 ? 'action_required' : 'warning',
      severity: lifeInsuranceOutsideIlit > 1_000_000 ? 'high' : 'medium',
      title: 'Life insurance outside an ILIT',
      description:
        `Your profile shows $${ilitRounded} in life insurance death benefit held outside an irrevocable life insurance trust (ILIT). ` +
        'An ILIT is one structure used to hold life insurance. Whether it fits your situation is a question for your advisor or estate attorney.',
      linkPath: '/insurance',
      context: { lifeInsuranceOutsideIlit },
    },
    {
      id: 'estate_gifting_gap',
      fire: largeEstateSignal && !hasGiftingProgram,
      alertType: 'warning',
      severity: 'medium',
      title: 'No annual gifting program on file',
      description:
        `Your profile shows a gross estate of about $${grossRounded} with no annual gifting program on file. ` +
        'Systematic gifting is one approach some households use to transfer wealth over time. Whether it fits your situation is a question for your advisor or estate attorney.',
      linkPath: '/my-estate-trust-strategy?tab=gifting',
      context: { grossEstate, largeEstateThreshold: largeEstateMin },
    },
    {
      id: 'estate_grat_opportunity',
      fire:
        businessInterestValue > GRAT_BUSINESS_THRESHOLD && !hasGratOnFile && largeEstateSignal,
      alertType: 'info',
      severity: 'low',
      title: 'Business interest — GRAT structure',
      description:
        `Your profile includes business interests valued above $${GRAT_BUSINESS_THRESHOLD.toLocaleString()} with no grantor retained annuity trust (GRAT) on file. ` +
        'A GRAT is one structure used to transfer business interests. Whether it fits your situation is a question for your advisor or estate attorney.',
      linkPath: '/my-estate-trust-strategy?tab=strategies',
      context: { businessInterestValue, hasGratOnFile, largeEstateSignal },
    },
    {
      id: 'estate_roth_window',
      fire: preTaxRetirementBalance > ROTH_PRE_TAX_THRESHOLD,
      alertType: 'info',
      severity: 'low',
      title: 'Pre-tax retirement balance',
      description:
        `Your profile shows a pre-tax retirement balance above $${ROTH_PRE_TAX_THRESHOLD.toLocaleString()} (about $${preTaxRounded} on file). ` +
        'The timing of Roth conversions can depend on your income from year to year. Whether and when a conversion makes sense is something to review with a tax professional or your advisor.',
      linkPath: '/roth',
      context: { preTaxRetirementBalance },
    },
    {
      id: 'estate_large_no_trust',
      fire: grossEstate >= LARGE_ESTATE_NO_TRUST_THRESHOLD && !hasTrustOnFile,
      alertType: 'action_required',
      severity: 'high',
      title: 'Large estate without a trust on file',
      description:
        `Your profile shows an estate of $${grossRounded} or more with no revocable trust on file. ` +
        'A revocable trust is one structure some households use for probate avoidance and distribution planning. Whether it fits your situation is a question for your advisor or estate attorney.',
      linkPath: '/my-estate-trust-strategy?tab=trusts',
      context: { grossEstate },
    },
    {
      id: 'estate_no_base_case',
      fire: hasEnteredAssets && !baseCaseId,
      alertType: 'action_required',
      severity: 'medium',
      title: 'Base-case estate projection not generated',
      description:
        'You have entered assets, but no base-case estate projection has been generated yet. Running a base case shows estate tax exposure and common planning topics on your dashboard.',
      linkPath: '/my-estate-trust-strategy',
      context: { hasEnteredAssets },
    },
  ]
}
