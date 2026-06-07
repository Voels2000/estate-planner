// Sprint 70 — Strategy Composability Validator

import type { EstateTaxBracket } from '@/lib/calculations/estate-tax'
import {
  calculateStateEstateTax,
  isMFJFilingStatus,
  resolveActiveStateTax,
  type StateBracket,
} from '@/lib/calculations/stateEstateTax'
import type { EstateScenario } from '@/lib/tax/estate-tax-constants'
import { computeCombinedEstateTax, computeFederalTaxOnly } from '@/lib/tax/federalExportTax'

export interface StrategyLayer {
  name: string
  estateReduction: number
  assetSource: string
  shareAssetPool?: string
}

export interface ComposabilityTaxContext {
  federalBrackets: EstateTaxBracket[]
  filingStatus: string | null | undefined
  hasSpouse: boolean
  lifetimeGiftsUsed?: number
  lawScenario?: EstateScenario
  statePrimary?: string | null
  stateBrackets?: StateBracket[]
  hasBypassTrust?: boolean
}

export interface ComposabilityResult {
  grossEstate: number
  totalReduction: number
  adjustedEstate: number
  hasDoubleCountingRisk: boolean
  doubleCountingWarnings: string[]
  netToHeirsWithStrategies: number
  netToHeirsBaseline: number
  totalTaxSavings: number
  strategyBreakdown: Array<{
    name: string
    reduction: number
    cumulativeEstate: number
  }>
  advisoryNotes: string[]
}

const FALLBACK_RATE = 0.4

function computeTotalTax(
  grossEstate: number,
  federalExemption: number,
  taxContext?: ComposabilityTaxContext,
): number {
  if (!taxContext?.federalBrackets?.length) {
    return Math.max(0, grossEstate - federalExemption) * FALLBACK_RATE
  }

  const federalCtx = {
    filingStatus: taxContext.filingStatus,
    hasSpouse: taxContext.hasSpouse,
    brackets: taxContext.federalBrackets,
    lifetimeGiftsUsed: taxContext.lifetimeGiftsUsed,
    lawScenario: taxContext.lawScenario,
    exemptionCapOverride: federalExemption,
  }

  if (taxContext.stateBrackets?.length) {
    return computeCombinedEstateTax(grossEstate, {
      ...federalCtx,
      statePrimary: taxContext.statePrimary,
      stateBrackets: taxContext.stateBrackets,
      hasBypassTrust: taxContext.hasBypassTrust,
    })
  }

  return computeFederalTaxOnly(grossEstate, federalCtx)
}

function computeStateTaxOnGross(
  grossEstate: number,
  taxContext: ComposabilityTaxContext | undefined,
): number {
  if (!taxContext?.stateBrackets?.length || grossEstate <= 0) return 0
  const stateResult = calculateStateEstateTax(
    grossEstate,
    taxContext.statePrimary ?? '',
    taxContext.stateBrackets,
    isMFJFilingStatus(taxContext.filingStatus),
    taxContext.hasBypassTrust ?? false,
  )
  return resolveActiveStateTax(stateResult, taxContext.hasBypassTrust ?? false)
}

export function validateStrategyComposability(
  grossEstate: number,
  federalExemption: number,
  strategies: StrategyLayer[],
  taxContext?: ComposabilityTaxContext,
): ComposabilityResult {
  const advisoryNotes: string[] = []
  const doubleCountingWarnings: string[] = []

  const assetPoolUsage: Record<string, string[]> = {}
  for (const s of strategies) {
    if (!assetPoolUsage[s.assetSource]) {
      assetPoolUsage[s.assetSource] = []
    }
    assetPoolUsage[s.assetSource].push(s.name)
  }

  let hasDoubleCountingRisk = false
  for (const [pool, strategyNames] of Object.entries(assetPoolUsage)) {
    if (strategyNames.length > 1) {
      hasDoubleCountingRisk = true
      doubleCountingWarnings.push(
        `⚠️ Double-counting risk: ${strategyNames.join(' and ')} both draw from "${pool}". ` +
          `Ensure these strategies use separate asset pools or the combined reduction is capped ` +
          `at the available assets in that pool.`,
      )
    }
  }

  const strategyBreakdown: ComposabilityResult['strategyBreakdown'] = []
  let remainingEstate = grossEstate
  let totalReduction = 0

  for (const strategy of strategies) {
    const effectiveReduction = Math.min(strategy.estateReduction, remainingEstate)
    remainingEstate -= effectiveReduction
    totalReduction += effectiveReduction

    strategyBreakdown.push({
      name: strategy.name,
      reduction: effectiveReduction,
      cumulativeEstate: remainingEstate,
    })
  }

  const adjustedEstate = Math.max(0, remainingEstate)

  const baselineTax = computeTotalTax(grossEstate, federalExemption, taxContext)
  const strategyTax = computeTotalTax(adjustedEstate, federalExemption, taxContext)
  const totalTaxSavings = baselineTax - strategyTax
  const netToHeirsBaseline = grossEstate - baselineTax
  const netToHeirsWithStrategies = adjustedEstate - strategyTax

  if (!hasDoubleCountingRisk) {
    advisoryNotes.push(
      `All ${strategies.length} strategies use separate asset pools — no double-counting detected. ` +
        `Combined estate reduction: $${Math.round(totalReduction).toLocaleString()}.`,
    )
  }

  advisoryNotes.push(
    `Combined strategy reduces gross estate from $${Math.round(grossEstate).toLocaleString()} ` +
      `to $${Math.round(adjustedEstate).toLocaleString()}, ` +
      `saving $${Math.round(totalTaxSavings).toLocaleString()} in estate tax.`,
  )

  advisoryNotes.push(
    `Net to heirs: $${Math.round(netToHeirsWithStrategies).toLocaleString()} with strategies ` +
      `vs $${Math.round(netToHeirsBaseline).toLocaleString()} baseline ` +
      `(+$${Math.round(netToHeirsWithStrategies - netToHeirsBaseline).toLocaleString()}).`,
  )

  return {
    grossEstate,
    totalReduction,
    adjustedEstate,
    hasDoubleCountingRisk,
    doubleCountingWarnings,
    netToHeirsWithStrategies,
    netToHeirsBaseline,
    totalTaxSavings,
    strategyBreakdown,
    advisoryNotes,
  }
}

export function build30MArchetype(federalExemption: number) {
  const grossEstate = 30_000_000
  const strategies: StrategyLayer[] = [
    { name: 'Annual Gifting (10 years)', estateReduction: 720_000, assetSource: 'investment_portfolio' },
    { name: 'Credit Shelter Trust', estateReduction: federalExemption / 2, assetSource: 'investment_portfolio_spouse1' },
    { name: 'SLAT', estateReduction: 5_000_000, assetSource: 'real_estate' },
    { name: 'ILIT Death Benefit', estateReduction: 3_000_000, assetSource: 'life_insurance' },
  ]
  return { grossEstate, strategies, federalExemption }
}

export function build100MArchetype(federalExemption: number) {
  const grossEstate = 100_000_000
  const strategies: StrategyLayer[] = [
    { name: 'Annual Gifting (10 years)', estateReduction: 720_000, assetSource: 'cash' },
    { name: 'Credit Shelter Trust', estateReduction: federalExemption / 2, assetSource: 'investment_portfolio_s1' },
    { name: 'SLAT', estateReduction: 10_000_000, assetSource: 'investment_portfolio_s2' },
    { name: 'GRAT Remainder', estateReduction: 8_000_000, assetSource: 'business_interest' },
    { name: 'ILIT Death Benefit', estateReduction: 5_000_000, assetSource: 'life_insurance' },
    { name: 'CLAT Remainder', estateReduction: 4_000_000, assetSource: 'real_estate' },
  ]
  return { grossEstate, strategies, federalExemption }
}

export function computeHorizonStrategyTaxes(params: {
  grossEstate: number
  adjustedGross: number
  federalExemption: number
  baselineFederalTax?: number | null
  baselineStateTax?: number | null
  taxContext?: ComposabilityTaxContext
}): {
  federalTaxBase: number
  stateTaxBase: number
  strategyFederalTax: number
  strategyStateTax: number
  totalTaxBase: number
  strategyTotalTax: number
} {
  const {
    grossEstate,
    adjustedGross,
    federalExemption,
    baselineFederalTax,
    baselineStateTax,
    taxContext,
  } = params

  const federalCtx = {
    filingStatus: taxContext?.filingStatus,
    hasSpouse: taxContext?.hasSpouse ?? false,
    brackets: taxContext?.federalBrackets ?? [],
    lifetimeGiftsUsed: taxContext?.lifetimeGiftsUsed,
    lawScenario: taxContext?.lawScenario,
    exemptionCapOverride: federalExemption,
  }

  const federalTaxBase = baselineFederalTax ?? computeFederalTaxOnly(grossEstate, federalCtx)
  const stateTaxBase = baselineStateTax ?? computeStateTaxOnGross(grossEstate, taxContext)
  const strategyFederalTax = computeFederalTaxOnly(adjustedGross, federalCtx)
  const strategyStateTax = computeStateTaxOnGross(adjustedGross, taxContext)

  return {
    federalTaxBase,
    stateTaxBase,
    strategyFederalTax,
    strategyStateTax,
    totalTaxBase: federalTaxBase + stateTaxBase,
    strategyTotalTax: strategyFederalTax + strategyStateTax,
  }
}
