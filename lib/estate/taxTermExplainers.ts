/**
 * Tax term explainers — educational copy for InfoTooltip labels.
 *
 * Static entries (no context needed):
 *
 * gross_estate — The total value of everything you own at death — real estate,
 * investments, retirement accounts, business interests, life insurance proceeds,
 * and personal property. This is the starting point for all estate tax calculations.
 *
 * taxable_estate — Your gross estate minus allowable deductions, primarily the
 * marital deduction (assets passing to a surviving spouse) and charitable deductions.
 * Estate tax is calculated on this amount, not your gross estate.
 *
 * federal_headroom — How far your estate is from the federal estate tax threshold.
 * As long as your estate stays below the exemption, no federal estate tax is owed.
 * This figure accounts for any lifetime gifts already applied against your exemption.
 *
 * federal_portability — A federal rule allowing a surviving spouse to claim their
 * deceased spouse's unused federal exemption by filing an estate tax return (Form 706)
 * within nine months of death. This can significantly increase the surviving spouse's
 * federal shield. Portability applies to federal estate tax only — most states with
 * their own estate tax do not allow it.
 */

import { OBBBA_2026 } from '@/lib/tax/estate-tax-constants'
import { getPortabilityGapLabel, getStateDisplayName } from '@/lib/calculations/stateEstateTax'

export type TaxTermKey =
  | 'gross_estate'
  | 'taxable_estate'
  | 'federal_exemption'
  | 'federal_headroom'
  | 'state_exemption'
  | 'federal_portability'
  | 'state_no_portability'
  | 'bypass_trust'
  | 'annual_exclusion'
  | 'superfunding'

export type TaxTermContext = {
  stateCode?: string | null
  stateExemption?: number | null
  isMFJ?: boolean
}

const TAX_TERM_EXPLAINERS_STATIC: Record<
  'gross_estate' | 'taxable_estate' | 'federal_headroom' | 'federal_portability',
  string
> = {
  gross_estate:
    'The total value of everything you own at death — real estate, investments, retirement accounts, business interests, life insurance proceeds, and personal property. This is the starting point for all estate tax calculations.',
  taxable_estate:
    'Your gross estate minus allowable deductions, primarily the marital deduction (assets passing to a surviving spouse) and charitable deductions. Estate tax is calculated on this amount, not your gross estate.',
  federal_headroom:
    'How far your estate is from the federal estate tax threshold. As long as your estate stays below the exemption, no federal estate tax is owed. This figure accounts for any lifetime gifts already applied against your exemption.',
  federal_portability:
    "A federal rule allowing a surviving spouse to claim their deceased spouse's unused federal exemption by filing an estate tax return (Form 706) within nine months of death. This can significantly increase the surviving spouse's federal shield. Portability applies to federal estate tax only — most states with their own estate tax do not allow it.",
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function exemptionAmountPhrase(stateExemption: number | null | undefined): string | null {
  if (stateExemption != null && stateExemption > 0) {
    return fmt(stateExemption)
  }
  return null
}

function firstSpouseExemptionPhrase(stateExemption: number | null | undefined): string {
  const amount = exemptionAmountPhrase(stateExemption)
  if (amount) return `the first spouse's ${amount} exemption`
  return "the first spouse's exemption"
}

function stateHasNoPortability(stateCode: string | null | undefined): boolean {
  return getPortabilityGapLabel(stateCode) !== null
}

function federalExemptionExplainer(): string {
  const s = fmt(OBBBA_2026.BASIC_EXCLUSION_SINGLE)
  const m = fmt(OBBBA_2026.BASIC_EXCLUSION_MFJ)
  return `The amount you can pass to heirs free of federal estate tax. Under current law, the basic exclusion is ${s} per individual (${m} for a married couple filing jointly). A surviving spouse may also claim a deceased spouse's unused federal exemption through portability, which can increase the couple's effective federal shield when properly elected.`
}

function annualExclusionExplainer(): string {
  const annual = fmt(OBBBA_2026.ANNUAL_GIFT_EXCLUSION)
  const annualMFJ = fmt(OBBBA_2026.ANNUAL_GIFT_EXCLUSION_SPLIT)
  return `The IRS allows each person to give up to ${annual} per recipient per year without using any lifetime exemption or filing a gift tax return. A married couple can give ${annualMFJ} per recipient per year combined. Systematic gifting reduces your taxable estate over time without touching your lifetime exemption.`
}

function superfundingExplainer(): string {
  const superAmt = fmt(OBBBA_2026.SUPERFUND_529_INDIVIDUAL)
  const superMFJ = fmt(OBBBA_2026.SUPERFUND_529_COUPLE)
  return `A one-time election to front-load five years of annual exclusion gifts into a 529 college savings account — up to ${superAmt} per individual (${superMFJ} per married couple, per beneficiary) — without gift tax consequences. The donor cannot make additional annual exclusion gifts to that beneficiary during the five-year period.`
}

function stateExemptionExplainer(ctx?: TaxTermContext): string {
  const generic =
    'Your state may impose its own estate tax with a lower exemption than the federal threshold. State estate taxes apply independently of federal tax and can significantly affect what passes to your heirs.'

  const code = ctx?.stateCode?.trim()
  if (!code) return generic

  const stateName = getStateDisplayName(code)
  const ex = ctx?.stateExemption
  if (ex == null || ex <= 0) {
    return `${stateName} may impose its own estate tax with an exemption that may be lower than the federal threshold. State estate taxes apply independently of federal tax and can significantly affect what passes to your heirs.`
  }

  return `${stateName}'s estate tax exemption is ${fmt(ex)} per individual. Estates above this threshold owe state estate tax regardless of federal liability.`
}

function stateNoPortabilityExplainer(ctx?: TaxTermContext): string {
  const generic =
    "Your state does not allow a surviving spouse to inherit the deceased spouse's unused state exemption. Without planning, the first spouse's exemption is permanently lost at death."

  const code = ctx?.stateCode?.trim()
  if (!code || !stateHasNoPortability(code)) return generic

  const stateName = getStateDisplayName(code)
  const firstEx = firstSpouseExemptionPhrase(ctx?.stateExemption)
  return `${stateName} does not allow portability of its estate tax exemption. Without a bypass trust, ${firstEx} is permanently lost at death — the surviving spouse receives only their own exemption.`
}

function bypassTrustExplainer(ctx?: TaxTermContext): string {
  const generic =
    "A trust funded at the first spouse's death that preserves both spouses' state estate tax exemptions. Without it, the first spouse's exemption is permanently lost in states that don't allow portability, increasing the eventual tax bill."

  const code = ctx?.stateCode?.trim()
  if (!code) return generic

  const stateName = getStateDisplayName(code)
  const ex = ctx?.stateExemption
  const firstEx = firstSpouseExemptionPhrase(ex)
  const exAmount = exemptionAmountPhrase(ex)

  if (exAmount != null && ctx?.isMFJ) {
    const doubled = fmt(ex! * 2)
    return `A bypass trust (also called a credit shelter trust) is funded at the first spouse's death to preserve both spouses' ${stateName} exemptions. Without it, ${firstEx} is permanently lost. With it, a married couple may shelter up to ${doubled} from ${stateName} estate tax instead of ${exAmount}.`
  }

  if (exAmount != null) {
    return `A bypass trust (also called a credit shelter trust) is funded at the first spouse's death to preserve both spouses' ${stateName} exemptions. Without it, ${firstEx} is permanently lost. With proper planning, a married couple may preserve more of their combined ${stateName} exemption than relying on a single spouse's exemption alone.`
  }

  return `A bypass trust (also called a credit shelter trust) is funded at the first spouse's death to preserve both spouses' ${stateName} exemptions. Without it, the first spouse's exemption may be permanently lost in states that do not allow portability, increasing the eventual ${stateName} estate tax bill.`
}

/**
 * Returns educational copy for InfoTooltip labels. Not legal advice — do not use in compliance footers.
 */
export function taxTermExplainer(key: TaxTermKey, ctx?: TaxTermContext): string {
  switch (key) {
    case 'gross_estate':
    case 'taxable_estate':
    case 'federal_headroom':
    case 'federal_portability':
      return TAX_TERM_EXPLAINERS_STATIC[key]
    case 'federal_exemption':
      return federalExemptionExplainer()
    case 'annual_exclusion':
      return annualExclusionExplainer()
    case 'superfunding':
      return superfundingExplainer()
    case 'state_exemption':
      return stateExemptionExplainer(ctx)
    case 'state_no_portability':
      return stateNoPortabilityExplainer(ctx)
    case 'bypass_trust':
      return bypassTrustExplainer(ctx)
    default: {
      const _exhaustive: never = key
      return _exhaustive
    }
  }
}
