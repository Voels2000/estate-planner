/**
 * Resolves the income deduction amount based on household deduction_mode.
 * Used by all projection engines to respect user deduction preferences.
 *
 * deduction_mode values:
 *   'standard' (or null/undefined) — use IRS standard deduction by filing status
 *   'custom'                       — use custom_deduction_amount
 *   'none'                         — no deduction ($0)
 */

const STANDARD_DEDUCTION_MFJ    = 29200
const STANDARD_DEDUCTION_SINGLE = 14600

export function resolveDeduction(
  deductionMode: string | null | undefined,
  customDeductionAmount: number | null | undefined,
  filingStatus: string
): number {
  if (deductionMode === 'custom') {
    return customDeductionAmount ?? 0
  }
  if (deductionMode === 'none') {
    return 0
  }
  // 'standard', null, or undefined — use IRS standard deduction
  const isMfj =
    filingStatus === 'married_joint' ||
    filingStatus === 'mfj' ||
    filingStatus === 'married_filing_jointly'
  return isMfj ? STANDARD_DEDUCTION_MFJ : STANDARD_DEDUCTION_SINGLE
}
