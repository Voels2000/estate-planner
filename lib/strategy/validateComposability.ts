// Sprint 70 — Strategy Composability Validator
//
// Tests that multiple strategies can be combined without double-counting
// estate reductions. Each strategy removes assets from the gross estate
// independently — the validator ensures the combined reduction never
// exceeds the gross estate and that no asset is counted twice.
//
// Validated archetypes:
//   $30M archetype: Gifting + CST + SLAT + ILIT
//   $100M archetype: Gifting + CST + SLAT + GRAT + ILIT + CLAT

export interface StrategyLayer {
  name: string
  estateReduction: number
  // Asset source this reduction draws from (prevents double-counting)
  assetSource: string
  // Whether this strategy's reduction is from the same asset pool as another
  shareAssetPool?: string
}

export interface ComposabilityResult {
  grossEstate: number
  totalReduction: number
  adjustedEstate: number
  // Whether any double-counting was detected
  hasDoubleCountingRisk: boolean
  doubleCountingWarnings: string[]
  // Net to heirs under combined strategy
  netToHeirsWithStrategies: number
  netToHeirsBaseline: number
  totalTaxSavings: number
  // Per-strategy breakdown
  strategyBreakdown: Array<{
    name: string
    reduction: number
    cumulativeEstate: number
  }>
  advisoryNotes: string[]
}

const ESTATE_TAX_RATE = 0.40

function calcTax(estate: number, exemption: number): number {
  return Math.max(0, estate - exemption) * ESTATE_TAX_RATE
}

export function validateStrategyComposability(
  grossEstate: number,
  federalExemption: number,
  strategies: StrategyLayer[]
): ComposabilityResult {
  const advisoryNotes: string[] = []
  const doubleCountingWarnings: string[] = []

  // Check for asset pool overlaps
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
          `at the available assets in that pool.`
      )
    }
  }

  // Apply strategies sequentially, reducing estate at each step
  const strategyBreakdown: ComposabilityResult['strategyBreakdown'] = []
  let remainingEstate = grossEstate
  let totalReduction = 0

  for (const strategy of strategies) {
    // Cap reduction at remaining estate to prevent negative estate
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

  // Tax comparison
  const baselineTax = calcTax(grossEstate, federalExemption)
  const strategyTax = calcTax(adjustedEstate, federalExemption)
  const totalTaxSavings = baselineTax - strategyTax
  const netToHeirsBaseline = grossEstate - baselineTax
  const netToHeirsWithStrategies = adjustedEstate - strategyTax

  if (!hasDoubleCountingRisk) {
    advisoryNotes.push(
      `All ${strategies.length} strategies use separate asset pools — no double-counting detected. ` +
        `Combined estate reduction: $${Math.round(totalReduction).toLocaleString()}.`
    )
  }

  advisoryNotes.push(
    `Combined strategy reduces gross estate from $${Math.round(grossEstate).toLocaleString()} ` +
      `to $${Math.round(adjustedEstate).toLocaleString()}, ` +
      `saving $${Math.round(totalTaxSavings).toLocaleString()} in estate tax.`
  )

  advisoryNotes.push(
    `Net to heirs: $${Math.round(netToHeirsWithStrategies).toLocaleString()} with strategies ` +
      `vs $${Math.round(netToHeirsBaseline).toLocaleString()} baseline ` +
      `(+$${Math.round(netToHeirsWithStrategies - netToHeirsBaseline).toLocaleString()}).`
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

// Pre-built archetypes for validation
export function build30MArchetype(federalExemption: number) {
  const grossEstate = 30_000_000
  const strategies: StrategyLayer[] = [
    {
      name: 'Annual Gifting (10 years)',
      estateReduction: 720_000,
      assetSource: 'investment_portfolio',
    },
    {
      name: 'Credit Shelter Trust',
      estateReduction: federalExemption / 2,
      assetSource: 'investment_portfolio_spouse1',
    },
    {
      name: 'SLAT',
      estateReduction: 5_000_000,
      assetSource: 'real_estate',
    },
    {
      name: 'ILIT Death Benefit',
      estateReduction: 3_000_000,
      assetSource: 'life_insurance',
    },
  ]
  return { grossEstate, strategies, federalExemption }
}

export function build100MArchetype(federalExemption: number) {
  const grossEstate = 100_000_000
  const strategies: StrategyLayer[] = [
    {
      name: 'Annual Gifting (10 years)',
      estateReduction: 720_000,
      assetSource: 'cash',
    },
    {
      name: 'Credit Shelter Trust',
      estateReduction: federalExemption / 2,
      assetSource: 'investment_portfolio_s1',
    },
    {
      name: 'SLAT',
      estateReduction: 10_000_000,
      assetSource: 'investment_portfolio_s2',
    },
    {
      name: 'GRAT Remainder',
      estateReduction: 8_000_000,
      assetSource: 'business_interest',
    },
    {
      name: 'ILIT Death Benefit',
      estateReduction: 5_000_000,
      assetSource: 'life_insurance',
    },
    {
      name: 'CLAT Remainder',
      estateReduction: 4_000_000,
      assetSource: 'real_estate',
    },
  ]
  return { grossEstate, strategies, federalExemption }
}
