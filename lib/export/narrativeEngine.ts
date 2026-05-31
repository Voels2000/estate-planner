// lib/export/narrativeEngine.ts
// Rule-based narrative engine for PDF estate planning reports.

import {
  calculateStateEstateTax,
  calculateStateTaxScenarios,
  getStateDisplayName,
  isMFJFilingStatus,
  resolveActiveStateTax,
  stateHasEstateTax,
  type StateBracket,
} from '@/lib/calculations/stateEstateTax'
import type { PDFReportData } from './generatePDFReport'
import type { ActionItem } from '@/lib/export-wiring'

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function fmtFull(n: number): string {
  return `$${Math.round(n).toLocaleString()}`
}

export function currentFederalExemption(filingStatus: string): number {
  return filingStatus === 'mfj' ? 27_980_000 : 13_990_000
}

function federalExemption(filingStatus: string): number {
  return currentFederalExemption(filingStatus)
}

function sunsetExemption(filingStatus: string): number {
  return filingStatus === 'mfj' ? 14_000_000 : 7_000_000
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'strong'
  if (score >= 65) return 'good'
  if (score >= 50) return 'fair'
  if (score >= 35) return 'needs attention'
  return 'critical — significant gaps exist'
}

function narrativeStateTaxContext(data: PDFReportData) {
  const brackets: StateBracket[] = data.stateBrackets ?? []
  const hasBypassTrust = Boolean(data.hasBypassTrust ?? data.hasIrrevocableTrust)
  const result = calculateStateEstateTax(
    data.grossEstate,
    data.domicileState,
    brackets,
    isMFJFilingStatus(data.filingStatus),
    hasBypassTrust,
  )
  const stateTax = resolveActiveStateTax(result, hasBypassTrust)
  const stateName = getStateDisplayName(data.domicileState)
  const hasStateTax = stateHasEstateTax(data.domicileState) || result.stateTax > 0
  const worstCaseWithoutBypass =
    !hasBypassTrust && result.hasPortabilityGap && result.stateTax > 0
  return { result, stateTax, stateName, hasStateTax, hasBypassTrust, brackets, worstCaseWithoutBypass }
}

/** Cover copy — worst-case MFJ no-portability states label bypass gap explicitly. */
function formatStateTaxExposure(
  amount: number,
  stateName: string,
  worstCaseWithoutBypass: boolean,
): string {
  if (worstCaseWithoutBypass) {
    return `an estimated ${fmt(amount)} in ${stateName} state estate tax exposure without a bypass trust`
  }
  return `an estimated ${fmt(amount)} in ${stateName} state estate tax exposure`
}

function isMissingTrustAlert(titleOrMessage: string): boolean {
  const t = titleOrMessage.toLowerCase()
  return (
    t.includes('trust') &&
    (t.includes('no trust') ||
      t.includes('without a trust') ||
      t.includes('without trust') ||
      t.includes('revocable trust'))
  )
}

function actionItemDedupeKey(item: ActionItem): string {
  return (item.title ?? item.message ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20)
}

/** Prefer themed/enriched rows when household_alerts emits duplicate titles. */
function actionItemEnrichmentScore(item: ActionItem): number {
  let score = 0
  if (item.theme && item.theme !== 'general') score += 4
  if (item.dollarImpact) score += 2
  if (item.nextStep) score += 1
  return score
}

export function generateExecutiveSummary(data: PDFReportData): string {
  const {
    grossEstate,
    healthScore,
    filingStatus,
    domicileState,
    hasTrust,
    hasGiftingProgram,
    federalTax,
    sunsetTaxEstimate,
    person2Name,
  } = data

  const { stateTax, stateName, hasStateTax, worstCaseWithoutBypass } = narrativeStateTaxContext(data)
  const fedExempt = federalExemption(filingStatus)
  const sunsetExempt = sunsetExemption(filingStatus)
  const isMarried = filingStatus === 'mfj' && !!person2Name
  const estateRef = isMarried ? 'Your combined estate' : 'Your estate'
  const sl = scoreLabel(healthScore)

  if (grossEstate < 1_000_000) {
    let s = `${estateRef} is currently valued at ${fmt(grossEstate)}, below federal and most state estate tax thresholds. `
    s += `The primary planning focus is ensuring proper beneficiary designations, a current will, and a clear distribution plan. `
    s += hasTrust
      ? `Your existing trust structure is a strong foundation for efficient asset transfer.`
      : `A revocable trust would simplify asset transfer at death and avoid probate.`
    return s
  }

  if (grossEstate < 3_000_000) {
    let s = `${estateRef} is ${fmt(grossEstate)}. `
    if (hasStateTax && stateTax > 0) {
      s += `Federal estate tax is not a current concern, but ${formatStateTaxExposure(stateTax, stateName, worstCaseWithoutBypass)}. `
    } else {
      s += `Federal estate tax is not a current concern${hasStateTax ? `, and your estate is below the ${stateName} exemption` : ''}. `
    }
    s += hasTrust
      ? `Your trust structure provides a strong foundation for probate avoidance. `
      : `Establishing a revocable trust is the highest-priority action to avoid probate. `
    s += `Your plan health score of ${healthScore}/100 is ${sl} — `
    s += healthScore < 60
      ? `key gaps in beneficiary designations or document completeness are driving the score down.`
      : `continued attention to document currency will keep it there.`
    return s
  }

  if (grossEstate < fedExempt) {
    const hasSunsetRisk = (sunsetTaxEstimate ?? 0) > 100_000
    let s = `${estateRef} is ${fmt(grossEstate)}`
    if (hasStateTax && stateTax > 0) {
      s += `, with ${formatStateTaxExposure(stateTax, stateName, worstCaseWithoutBypass)}`
    }
    s += `. `
    if (hasSunsetRisk) {
      s += `Critically, the TCJA exemption sunset could reduce the federal exemption to ${fmt(sunsetExempt)}, `
      s += `creating a potential ${fmt(sunsetTaxEstimate!)} in new federal tax exposure that does not exist today — `
      s += `acting before year-end preserves the current exemption. `
    } else {
      s += `Your estate is below the current federal exemption under current law. `
    }
    s += hasTrust
      ? `Your trust structure is a strong foundation. `
      : `Establishing a revocable trust is the most urgent structural gap. `
    s += hasGiftingProgram
      ? `Your gifting program is actively working to reduce future exposure.`
      : `Adding a systematic gifting strategy could meaningfully reduce long-term exposure.`
    return s
  }

  let s = `${estateRef} of ${fmt(grossEstate)} is above the current federal exemption, `
  s += `with an estimated ${fmtFull(federalTax ?? 0)} in federal estate tax`
  if (stateTax > 0) {
    s += worstCaseWithoutBypass
      ? ` and ${fmt(stateTax)} in ${stateName} state tax without a bypass trust`
      : ` and ${fmt(stateTax)} in ${stateName} state tax`
  }
  s += `. Reducing this exposure requires a coordinated strategy. `
  s += data.hasIrrevocableTrust
    ? `Your irrevocable trust structure is a strong foundation — review current exemption utilization and consider additional funding. `
    : `Establishing irrevocable trust structures (SLAT, ILIT, or credit shelter trust) should be prioritized. `
  s += hasGiftingProgram
    ? `Your existing gifting program is actively reducing the taxable estate.`
    : `A systematic gifting program using the ${fmt(data.annualGiftingCapacity)}/yr annual exclusion and remaining lifetime exemption is a high-priority next step.`
  return s
}

export type TaxCalloutStyle = 'clear' | 'sunset_risk' | 'exposed'

export interface TaxCallout {
  style: TaxCalloutStyle
  headline: string
  detail: string
}

export function generateTaxCallout(data: PDFReportData): TaxCallout {
  const { grossEstate, federalTax, filingStatus, domicileState, sunsetTaxEstimate } = data

  const { stateTax, stateName, hasStateTax, brackets } = narrativeStateTaxContext(data)
  const fedExempt = federalExemption(filingStatus)
  const sunsetExempt = sunsetExemption(filingStatus)
  const hasSunset = (sunsetTaxEstimate ?? 0) > 100_000
  const totalCurrent = (federalTax ?? 0) + stateTax

  const scenarios = calculateStateTaxScenarios({
    grossEstate,
    stateCode: domicileState,
    brackets,
    filingStatus,
  })
  const planningGap = scenarios.planningGap
  const planningGapNote =
    planningGap > 100_000
      ? ` Without a bypass trust, ${stateName} tax increases by ${fmt(planningGap)}.`
      : ''

  if ((federalTax ?? 0) > 0) {
    const detail =
      hasStateTax && stateTax > 0
        ? `Federal: ${fmtFull(federalTax ?? 0)} · ${stateName} state: ${fmt(stateTax)} · Total estimated: ${fmtFull(totalCurrent)}${planningGapNote}`
        : `Federal: ${fmtFull(federalTax ?? 0)} · No state estate tax in ${stateName}${planningGapNote}`
    return {
      style: 'exposed',
      headline: `Estimated estate tax: ${fmtFull(totalCurrent)}`,
      detail,
    }
  }

  if (hasSunset) {
    const stateDetail =
      hasStateTax && stateTax > 0 ? ` · ${stateName} state tax: ${fmt(stateTax)}` : ''
    return {
      style: 'sunset_risk',
      headline: `No tax today — but TCJA sunset creates up to ${fmt(sunsetTaxEstimate!)} in new exposure`,
      detail: `Current exemption: ${fmt(fedExempt)} · Post-sunset exemption: ${fmt(sunsetExempt)}${stateDetail}${planningGapNote}. Consider pre-sunset gifting and trust funding.`,
    }
  }

  const stateNote = hasStateTax
    ? stateTax > 0
      ? ` · ${stateName} state tax: ${fmt(stateTax)}`
      : ` · ${stateName} state tax: below exemption`
    : ` · No state estate tax in ${stateName}`
  return {
    style: 'clear',
    headline: `No federal estate tax under current law`,
    detail: `Estate of ${fmt(grossEstate)} is below the ${fmt(fedExempt)} federal exemption${stateNote}${planningGapNote}. Monitor as estate grows.`,
  }
}

export interface HealthTrend {
  current: number
  delta: number | null
  label: string
  interpretation: string
}

export function generateHealthTrend(data: PDFReportData): HealthTrend {
  const { healthScore, priorHealthScore } = data
  if (priorHealthScore == null) {
    return { current: healthScore, delta: null, label: `${healthScore}/100`, interpretation: 'No prior data' }
  }
  const delta = healthScore - priorHealthScore
  const sign = delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : '→ '
  const interp = delta > 2 ? 'Improving' : delta < -2 ? 'Declining' : 'Stable'
  return {
    current: healthScore,
    delta,
    label: `${healthScore}/100 (${sign}${delta} since last session)`,
    interpretation: interp,
  }
}

export function enrichActionItems(items: ActionItem[], data: PDFReportData): ActionItem[] {
  const { grossEstate, lifeInsuranceOutsideILIT, domicileState } = data
  const probateCostLow = Math.round(grossEstate * 0.02)
  const probateCostHigh = Math.round(grossEstate * 0.04)
  const { stateTax, stateName } = narrativeStateTaxContext(data)

  return items.map((item) => {
    const t = (item.title ?? item.message ?? '').toLowerCase()

    if (isMissingTrustAlert(t)) {
      return {
        ...item,
        theme: 'documents' as const,
        owner: 'attorney' as const,
        dollarImpact: `Probate could cost ${fmt(probateCostLow)}–${fmt(probateCostHigh)} in fees and months of delay`,
        nextStep: 'Engage estate attorney to draft revocable living trust and pour-over will',
      }
    }

    if (t.includes('sole ownership') || t.includes('one spouse') || t.includes('titling')) {
      return {
        ...item,
        theme: 'titling' as const,
        owner: 'advisor' as const,
        dollarImpact: `Assets in one spouse's name only create probate exposure and complicate estate administration`,
        nextStep: 'Audit account titling and re-title joint assets to both spouses or to trust',
      }
    }

    if (t.includes('no primary beneficiary') || (t.includes('missing') && t.includes('beneficiary') && !t.includes('contingent'))) {
      return {
        ...item,
        theme: 'beneficiary' as const,
        owner: 'client' as const,
        dollarImpact: `Assets without a primary beneficiary pass through probate — potentially ${fmt(probateCostLow)}+ in avoidable costs`,
        nextStep: 'Contact plan custodian to designate primary beneficiary on each affected account',
      }
    }

    if (t.includes('contingent') && t.includes('beneficiary')) {
      return {
        ...item,
        theme: 'beneficiary' as const,
        owner: 'client' as const,
        dollarImpact: `If the primary beneficiary predeceases, assets pass through probate without a contingent named`,
        nextStep: 'Add contingent beneficiary designations to all accounts that currently lack them',
      }
    }

    if (t.includes('gifting') || t.includes('annual gift')) {
      const annual = data.annualGiftingCapacity
      const tenYear = annual * 10
      return {
        ...item,
        theme: 'tax_planning' as const,
        owner: 'advisor' as const,
        dollarImpact: `${fmt(annual)}/yr annual exclusion is currently unused — ${fmt(tenYear)} over 10 years transferred tax-free`,
        nextStep: 'Review gifting capacity and establish recurring annual gifts to heirs or 529 accounts',
      }
    }

    if (t.includes('ilit') || t.includes('life insurance')) {
      const potentialSavings = Math.round(lifeInsuranceOutsideILIT * 0.40)
      return {
        ...item,
        theme: 'tax_planning' as const,
        owner: 'advisor' as const,
        dollarImpact:
          potentialSavings > 0
            ? `Moving policy to an ILIT could save ~${fmt(potentialSavings)} in estate tax on the death benefit`
            : `Life insurance proceeds outside an ILIT are included in the taxable estate`,
        nextStep: 'Review life insurance ownership structure with estate attorney and insurance advisor',
      }
    }

    if (t.includes('sunset') || t.includes('tcja') || t.includes('exemption')) {
      return {
        ...item,
        theme: 'tax_planning' as const,
        owner: 'advisor' as const,
        dollarImpact: data.sunsetTaxEstimate
          ? `Potential new federal exposure at sunset: ~${fmt(data.sunsetTaxEstimate)}`
          : `Reduced exemption could create significant new federal estate tax exposure`,
        nextStep: 'Model accelerated gifting and trust funding before year-end to lock in current exemption',
      }
    }

    if (t.includes('state') && t.includes('tax') && stateTax > 0) {
      return {
        ...item,
        theme: 'tax_planning' as const,
        owner: 'advisor' as const,
        dollarImpact: `Estimated ${stateName} state estate tax: ${fmt(stateTax)}`,
        nextStep: 'Review domicile planning and state-specific trust strategies with estate attorney',
      }
    }

    return { ...item, theme: 'general' as const, owner: 'advisor' as const }
  })
}

/** Drop duplicate alerts (same root issue, different household_alerts rows). Keeps enriched match. */
export function dedupeActionItems(items: ActionItem[]): ActionItem[] {
  const bestByKey = new Map<string, ActionItem>()

  for (const item of items) {
    const key = actionItemDedupeKey(item)
    if (!key) continue
    const existing = bestByKey.get(key)
    if (!existing || actionItemEnrichmentScore(item) > actionItemEnrichmentScore(existing)) {
      bestByKey.set(key, item)
    }
  }

  const seen = new Set<string>()
  const result: ActionItem[] = []

  for (const item of items) {
    const key = actionItemDedupeKey(item)
    if (!key) {
      result.push(item)
      continue
    }
    if (seen.has(key)) continue
    seen.add(key)
    result.push(bestByKey.get(key) ?? item)
  }

  return result
}

export interface GiftingSummary {
  show: boolean
  annualPerPerson: number
  annualTotal: number
  lifetimeRemaining: number
  superfunding529: number
  headline: string
}

export function generateGiftingSummary(data: PDFReportData): GiftingSummary {
  const { grossEstate, annualGiftingCapacity, lifetimeExemptionRemaining, filingStatus } = data
  const show = grossEstate >= 1_000_000

  if (!show) {
    return { show: false, annualPerPerson: 0, annualTotal: 0, lifetimeRemaining: 0, superfunding529: 0, headline: '' }
  }

  const perPerson = filingStatus === 'mfj' ? 19_000 : 19_000
  const total = annualGiftingCapacity
  const superfunding = total * 5
  const headline = `${fmt(total)}/yr annual exclusion · ${fmt(lifetimeExemptionRemaining)} lifetime remaining · ${fmt(superfunding)} 529 superfunding available`

  return {
    show: true,
    annualPerPerson: perPerson,
    annualTotal: total,
    lifetimeRemaining: lifetimeExemptionRemaining,
    superfunding529: superfunding,
    headline,
  }
}

export type ActionThemeGroup = {
  theme: string
  label: string
  items: ActionItem[]
}

const THEME_ORDER: NonNullable<ActionItem['theme']>[] = ['documents', 'titling', 'beneficiary', 'tax_planning', 'general']
const THEME_LABELS: Record<string, string> = {
  documents: 'Documents & trust structure',
  titling: 'Account titling',
  beneficiary: 'Beneficiary designations',
  tax_planning: 'Tax planning & strategies',
  general: 'Additional recommendations',
}

export function groupActionItems(items: ActionItem[]): ActionThemeGroup[] {
  const map = new Map<string, ActionItem[]>()
  for (const theme of THEME_ORDER) map.set(theme, [])

  for (const item of items) {
    const t = item.theme ?? 'general'
    if (!map.has(t)) map.set(t, [])
    map.get(t)!.push(item)
  }

  return Array.from(map.entries())
    .filter(([, groupItems]) => groupItems.length > 0)
    .map(([theme, groupItems]) => ({
      theme,
      label: THEME_LABELS[theme] ?? theme,
      items: groupItems,
    }))
}
