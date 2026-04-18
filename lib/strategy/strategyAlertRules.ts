// Sprint 70 — Strategy Alert Rules
//
// Four new alert rules added to the centralized alert_rules engine (Sprint 61).
// These rules evaluate strategy gaps and trigger household_alerts when conditions are met.
// Rules are seeded into the alert_rules table via SQL (see CURSOR_SCRIPT.md).
//
// Rule IDs (to be seeded):
//   strategy_no_gifting        — household has taxable estate but no gifting program
//   strategy_no_ilit           — household has life insurance outside an ILIT
//   strategy_grat_opportunity  — household has appreciating business/PE assets, no GRAT
//   strategy_roth_window       — household has large pre-tax IRA in low-income year

export interface StrategyAlertInput {
  householdId: string
  grossEstate: number
  filingStatus?: 'single' | 'mfj' | 'married_joint'
  federalExemption: number
  hasGiftingProgram: boolean
  hasILIT: boolean
  lifeInsuranceOutsideILIT: number
  hasGRAT: boolean
  businessInterestValue: number
  preIRABalance: number
  estimatedCurrentYearIncome: number
  marginalTaxRate: number
}

export interface StrategyAlertOutput {
  ruleId: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  message: string
  shouldFire: boolean
  contextData: Record<string, unknown>
}

export function evaluateStrategyAlerts(input: StrategyAlertInput): StrategyAlertOutput[] {
  const alerts: StrategyAlertOutput[] = []
  const {
    grossEstate,
    federalExemption,
    hasGiftingProgram,
    hasILIT,
    lifeInsuranceOutsideILIT,
    hasGRAT,
    businessInterestValue,
    preIRABalance,
    estimatedCurrentYearIncome,
    marginalTaxRate,
  } = input

  const LARGE_ESTATE_THRESHOLD_SINGLE = 10_000_000
  const LARGE_ESTATE_THRESHOLD_MFJ = 20_000_000
  const largeEstateThreshold =
    input.filingStatus === 'mfj' || input.filingStatus === 'married_joint'
      ? LARGE_ESTATE_THRESHOLD_MFJ
      : LARGE_ESTATE_THRESHOLD_SINGLE
  const largeEstateSignal = grossEstate > largeEstateThreshold

  // Rule 1: No gifting program on taxable estate
  alerts.push({
    ruleId: 'strategy_no_gifting',
    severity: 'warning',
    title: 'No Annual Gifting Program',
    message:
      `This household has a gross estate of $${Math.round(grossEstate).toLocaleString()} ` +
      `but no annual gifting program is on record. A systematic gifting program could remove ` +
      `$72,000+ per year from the taxable estate with no gift tax cost.`,
    shouldFire: largeEstateSignal && !hasGiftingProgram,
    contextData: { grossEstate, federalExemption, largeEstateSignal },
  })

  // Rule 2: Life insurance outside ILIT
  alerts.push({
    ruleId: 'strategy_no_ilit',
    severity: lifeInsuranceOutsideILIT > 1_000_000 ? 'critical' : 'warning',
    title: 'Life Insurance Outside ILIT',
    message:
      `$${Math.round(lifeInsuranceOutsideILIT).toLocaleString()} in life insurance death benefit ` +
      `is included in the gross estate. Transferring this policy to an ILIT (or having the ILIT ` +
      `purchase a new policy) would remove it from the taxable estate, ` +
      `saving approximately $${Math.round(lifeInsuranceOutsideILIT * 0.40).toLocaleString()} in estate tax.`,
    shouldFire: lifeInsuranceOutsideILIT > 0 && !hasILIT,
    contextData: { lifeInsuranceOutsideILIT, estimatedTaxSavings: lifeInsuranceOutsideILIT * 0.40 },
  })

  // Rule 3: GRAT opportunity on business/PE assets
  alerts.push({
    ruleId: 'strategy_grat_opportunity',
    severity: 'info',
    title: 'GRAT Opportunity — Appreciating Assets',
    message:
      `This household holds $${Math.round(businessInterestValue).toLocaleString()} in business ` +
      `or private equity interests with high appreciation potential. A GRAT could transfer ` +
      `appreciation above the §7520 hurdle rate to beneficiaries gift-tax free.`,
    shouldFire: businessInterestValue > 500_000 && !hasGRAT && largeEstateSignal,
    contextData: { businessInterestValue },
  })

  // Rule 4: Roth conversion window
  const isLowIncomeYear = estimatedCurrentYearIncome < 400_000 && marginalTaxRate <= 0.32
  alerts.push({
    ruleId: 'strategy_roth_window',
    severity: 'info',
    title: 'Roth Conversion Opportunity',
    message:
      `This household has $${Math.round(preIRABalance).toLocaleString()} in pre-tax retirement ` +
      `accounts and appears to be in a lower income year (estimated marginal rate: ` +
      `${(marginalTaxRate * 100).toFixed(0)}%). This may be an optimal window for Roth conversions ` +
      `before rates rise or RMDs force higher-bracket distributions.`,
    shouldFire: preIRABalance > 500_000 && isLowIncomeYear,
    contextData: { preIRABalance, marginalTaxRate, estimatedCurrentYearIncome },
  })

  return alerts.filter((a) => a.shouldFire)
}

// SQL to seed the 4 alert rules into alert_rules table
// Run in Supabase SQL editor after deploying this sprint
export const STRATEGY_ALERT_RULES_SQL = `
INSERT INTO alert_rules (rule_key, title, description, severity, category, is_active)
VALUES
  ('strategy_no_gifting', 'No Annual Gifting Program', 
   'Household has taxable estate but no gifting program on record', 
   'warning', 'strategy', true),
  ('strategy_no_ilit', 'Life Insurance Outside ILIT', 
   'Life insurance death benefit is included in gross estate', 
   'warning', 'strategy', true),
  ('strategy_grat_opportunity', 'GRAT Opportunity — Appreciating Assets', 
   'Business or PE assets with GRAT potential detected', 
   'info', 'strategy', true),
  ('strategy_roth_window', 'Roth Conversion Window', 
   'Low-income year detected with large pre-tax IRA balance', 
   'info', 'strategy', true)
ON CONFLICT (rule_key) DO NOTHING;`
