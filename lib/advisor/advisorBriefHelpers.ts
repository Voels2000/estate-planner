// Shared helpers for advisor-facing alert display across all four surfaces.
// Import from here — do not re-implement in individual components.

import { enrichActionItems, dedupeActionItems } from '@/lib/export/narrativeEngine'
import type { ActionItem } from '@/lib/export-wiring'

export interface BriefAlert {
  title: string
  severity: string
  body: string
  dollarImpact?: string
  nextStep?: string
  owner?: string
  suggestedMinutes: number
}

export function formatAlertsForBrief(
  rawAlerts: ActionItem[],
  data: {
    grossEstate: number
    domicileState: string
    filingStatus: string
    stateBrackets?: Parameters<typeof enrichActionItems>[1]['stateBrackets']
    hasIrrevocableTrust?: boolean
    hasBypassTrust?: boolean
    hasTrust?: boolean
    lifeInsuranceOutsideILIT?: number
    sunsetTaxEstimate?: number
    federalTax?: number
  },
): BriefAlert[] {
  const enriched = enrichActionItems(rawAlerts, {
    grossEstate: data.grossEstate,
    domicileState: data.domicileState,
    filingStatus: data.filingStatus as 'mfj' | 'single' | 'widow',
    stateBrackets: data.stateBrackets ?? [],
    hasIrrevocableTrust: data.hasIrrevocableTrust ?? false,
    hasBypassTrust: data.hasBypassTrust ?? false,
    hasTrust: data.hasTrust ?? false,
    lifeInsuranceOutsideILIT: data.lifeInsuranceOutsideILIT ?? 0,
    sunsetTaxEstimate: data.sunsetTaxEstimate ?? 0,
    federalTax: data.federalTax ?? 0,
    healthScore: 0,
    netWorth: data.grossEstate,
    liquidAssets: 0,
    illiquidAssets: 0,
    assetBreakdown: [],
    federalExemption: 0,
    lawScenario: 'current_law',
    stateTax: 0,
    activeStrategies: [],
    actionItems: rawAlerts,
    hasGiftingProgram: false,
    annualGiftingCapacity: 0,
    lifetimeExemptionRemaining: 0,
  } as unknown as Parameters<typeof enrichActionItems>[1])
  const deduped = dedupeActionItems(enriched)

  return deduped.map((item) => ({
    title: item.title ?? item.body ?? item.message ?? '',
    severity: item.severity ?? 'medium',
    body: item.body ?? item.message ?? '',
    dollarImpact: item.dollarImpact,
    nextStep: item.nextStep,
    owner: item.owner,
    suggestedMinutes: item.severity === 'high' || item.severity === 'critical' ? 20 : item.severity === 'medium' ? 10 : 5,
  }))
}

export interface AgendaItem {
  order: number
  title: string
  minutes: number
  owner: string
  impact?: string
}

export function deriveAgenda(alerts: BriefAlert[]): AgendaItem[] {
  return alerts.slice(0, 3).map((a, i) => ({
    order: i + 1,
    title: a.title,
    minutes: a.suggestedMinutes,
    owner: a.owner ?? 'advisor',
    impact: a.dollarImpact,
  }))
}

export function scoreTrendLabel(
  current: number,
  prior: number | null,
): { delta: number | null; label: string; direction: 'up' | 'down' | 'flat' | 'none' } {
  if (prior === null) return { delta: null, label: `${current}/100`, direction: 'none' }
  const delta = current - prior
  if (delta > 0) return { delta, label: `▲ +${delta} since last session`, direction: 'up' }
  if (delta < 0) return { delta, label: `▼ ${delta} since last session`, direction: 'down' }
  return { delta: 0, label: '→ unchanged', direction: 'flat' }
}

export function engagementLabel(lastSignInAt: string | null): string {
  if (!lastSignInAt) return 'No recent login'
  const days = Math.floor((Date.now() - new Date(lastSignInAt).getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Logged in today'
  if (days === 1) return 'Logged in yesterday'
  if (days <= 30) return `Logged in ${days} days ago`
  return `Last login: ${Math.round(days / 30)} months ago`
}

export interface AdvisorBranding {
  firmName: string
  advisorName: string
  advisorPhone?: string
  advisorEmail?: string
  firmLogoUrl?: string
}

export function resolveAdvisorBranding(profile: {
  firm_name?: string | null
  full_name?: string | null
  phone?: string | null
  email?: string | null
  firm_logo_url?: string | null
}): AdvisorBranding {
  return {
    firmName: profile.firm_name ?? 'My Wealth Maps',
    advisorName: profile.full_name ?? 'Your Advisor',
    advisorPhone: profile.phone ?? undefined,
    advisorEmail: profile.email ?? undefined,
    firmLogoUrl: profile.firm_logo_url ?? undefined,
  }
}

const RETIREMENT_ASSET_TYPES = new Set([
  'traditional_ira',
  'rollover_ira',
  'ira',
  'sep_ira',
  'simple_ira',
  'traditional_401k',
  '401k',
  '403b',
  'traditional_403b',
  '457',
  'retirement_account',
  'roth_ira',
  'roth_401k',
  'roth_403b',
])

function isRetirementAssetType(type: string | null | undefined): boolean {
  const t = (type ?? '').toLowerCase()
  return RETIREMENT_ASSET_TYPES.has(t) || t.includes('401k') || t.includes('403b') || t.includes('ira')
}

type AssetLike = { type?: string | null; value?: number | null }
type RealEstateLike = { current_value?: number | null }
type BusinessLike = { estimated_value?: number | null; ownership_pct?: number | null }
type InsuranceLike = { death_benefit?: number | null }

export const HEALTH_COMPONENT_LABELS: Record<string, string> = {
  documents: 'Estate Documents',
  incapacity: 'Incapacity Planning',
  beneficiaries: 'Beneficiary Designations',
  titling: 'Asset Titling',
  domicile: 'Domicile Clarity',
  estate_tax: 'Estate Tax Awareness',
}

export function mapHealthComponentsForPdf(
  componentScores:
    | Record<string, { label?: string; score?: number; maxScore?: number }>
    | null
    | undefined,
): Array<{ label: string; score: number; maxScore: number }> {
  return Object.entries(componentScores ?? {}).map(([key, val]) => ({
    label: val?.label ?? HEALTH_COMPONENT_LABELS[key] ?? key.replace(/_/g, ' '),
    score: val?.score ?? 0,
    maxScore: val?.maxScore ?? 1,
  }))
}

type CompositionBreakdownLike = {
  inside_financial?: number | null
  inside_real_estate?: number | null
  inside_business_gross?: number | null
  inside_insurance?: number | null
}

export function buildPdfAssetBreakdown(params: {
  assets: AssetLike[]
  realEstate: RealEstateLike[]
  businesses: BusinessLike[]
  businessInterests?: Array<{ fmv_estimated?: number | null; ownership_pct?: number | null }>
  insurancePolicies: InsuranceLike[]
  compositionFallback?: CompositionBreakdownLike | null
}): Array<{ label: string; value: number; pct: number }> {
  const { assets, realEstate, businesses, businessInterests, insurancePolicies, compositionFallback } =
    params

  const retirementValue = assets
    .filter((a) => isRetirementAssetType(a.type))
    .reduce((s, a) => s + Number(a.value ?? 0), 0)

  const financialValue = assets
    .filter((a) => !isRetirementAssetType(a.type))
    .reduce((s, a) => s + Number(a.value ?? 0), 0)

  const realEstateValue = realEstate.reduce((s, r) => s + Number(r.current_value ?? 0), 0)

  const businessTableValue = businesses.reduce(
    (s, b) => s + Number(b.estimated_value ?? 0) * (Number(b.ownership_pct ?? 100) / 100),
    0,
  )

  const businessInterestValue = (businessInterests ?? []).reduce(
    (s, b) => s + Number(b.fmv_estimated ?? 0) * (Number(b.ownership_pct ?? 100) / 100),
    0,
  )

  const businessValue = businessTableValue + businessInterestValue

  const insuranceValue = insurancePolicies.reduce((s, p) => s + Number(p.death_benefit ?? 0), 0)

  let assetCategories = [
    { label: 'Financial assets', value: financialValue },
    { label: 'Real estate', value: realEstateValue },
    { label: 'Business interests', value: businessValue },
    { label: 'Retirement accounts', value: retirementValue },
    { label: 'Life insurance', value: insuranceValue },
  ].filter((c) => c.value > 0)

  if (assetCategories.length === 0 && compositionFallback) {
    assetCategories = [
      { label: 'Financial assets', value: Number(compositionFallback.inside_financial ?? 0) },
      { label: 'Real estate', value: Number(compositionFallback.inside_real_estate ?? 0) },
      { label: 'Business interests', value: Number(compositionFallback.inside_business_gross ?? 0) },
      { label: 'Life insurance', value: Number(compositionFallback.inside_insurance ?? 0) },
    ].filter((c) => c.value > 0)
  }

  if (assetCategories.length === 0) return []

  const grossForPct = assetCategories.reduce((s, c) => s + c.value, 0) || 1

  return assetCategories.map((c) => ({
    label: c.label,
    value: Math.round(c.value),
    pct: c.value / grossForPct,
  }))
}

export function complexityMeetingInterp(score: number): string {
  if (score >= 75) return 'Very high — plan for 90+ minutes'
  if (score >= 50) return 'High — plan for 60 minutes'
  if (score >= 25) return 'Moderate — 45 minutes typical'
  return 'Low — 30 minutes typical'
}
