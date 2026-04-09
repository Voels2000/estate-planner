// Sprint 68 — GST Exemption Ledger + Income Tax Drag Module
//
// GST (Generation-Skipping Transfer) tax applies to transfers to skip persons
// (grandchildren or trusts for their benefit). Each taxpayer has a GST exemption
// equal to the federal estate tax exemption ($13.61M in 2026).
//
// Income tax drag: grantor trusts cause the grantor to pay income tax on trust
// income, which reduces the grantor's taxable estate (a planning benefit).
// Non-grantor trusts pay their own income tax at compressed trust rates.

export interface GSTTransfer {
  year: number
  amount: number
  gstExemptionAllocated: number
  isSkipPerson: boolean
  beneficiaryLabel: string
}

export interface GSTLedgerResult {
  // Total GST exemption used across all transfers
  totalExemptionUsed: number
  // Remaining GST exemption available
  remainingExemption: number
  // Total transfers to skip persons
  totalSkipTransfers: number
  // Whether any skip transfers exceed available exemption (GST tax owed)
  gstTaxExposure: boolean
  // Estimated GST tax owed on unprotected transfers (40% flat rate)
  estimatedGSTTax: number
  // Per-transfer summary
  transferSummary: GSTTransfer[]
  // Advisory notes
  advisoryNotes: string[]
}

export interface IncomeTaxDragConfig {
  // Annual trust income
  annualTrustIncome: number
  // Is this a grantor trust? (grantor pays tax) or non-grantor (trust pays tax)
  isGrantorTrust: boolean
  // Grantor's marginal income tax rate
  grantorMarginalRate: number
  // Years of projection
  projectionYears: number
}

export interface IncomeTaxDragResult {
  // Annual income tax cost
  annualTaxCost: number
  // Who pays: 'grantor' or 'trust'
  taxPaidBy: 'grantor' | 'trust'
  // Total tax paid over projection period
  totalTaxOverPeriod: number
  // Estate benefit if grantor trust (tax paid by grantor = additional estate depletion)
  additionalEstateDepleted: number
  // Effective after-tax growth rate (for non-grantor trusts at compressed rates)
  effectiveAfterTaxGrowthNote: string
  // Advisory notes
  advisoryNotes: string[]
}

// GST flat tax rate (same as estate tax top rate)
const GST_TAX_RATE = 0.4

// 2026 GST exemption (mirrors federal estate tax exemption)
const GST_EXEMPTION_2026 = 13_610_000

export function trackGSTLedger(
  transfers: GSTTransfer[],
  availableExemption: number = GST_EXEMPTION_2026
): GSTLedgerResult {
  const advisoryNotes: string[] = []
  let totalExemptionUsed = 0
  let totalSkipTransfers = 0

  for (const transfer of transfers) {
    if (transfer.isSkipPerson) {
      totalSkipTransfers += transfer.amount
      totalExemptionUsed += transfer.gstExemptionAllocated
    }
  }

  const remainingExemption = Math.max(0, availableExemption - totalExemptionUsed)
  const unprotectedSkipTransfers = Math.max(0, totalSkipTransfers - totalExemptionUsed)
  const gstTaxExposure = unprotectedSkipTransfers > 0
  const estimatedGSTTax = unprotectedSkipTransfers * GST_TAX_RATE

  if (gstTaxExposure) {
    advisoryNotes.push(
      `⚠️ GST Tax Exposure: $${Math.round(unprotectedSkipTransfers).toLocaleString()} in skip-person ` +
      `transfers are not covered by GST exemption. Estimated GST tax: ` +
      `$${Math.round(estimatedGSTTax).toLocaleString()} at the 40% flat rate.`
    )
  }

  if (remainingExemption > 0 && totalSkipTransfers === 0) {
    advisoryNotes.push(
      `$${remainingExemption.toLocaleString()} in GST exemption remains unused. ` +
      `Consider allocating to dynasty trust or direct skip transfers to grandchildren ` +
      `to leverage the exemption before potential sunset.`
    )
  }

  if (totalExemptionUsed > 0) {
    advisoryNotes.push(
      `GST exemption allocated: $${totalExemptionUsed.toLocaleString()} across ` +
      `${transfers.filter((t) => t.isSkipPerson).length} skip-person transfer(s).`
    )
  }

  return {
    totalExemptionUsed,
    remainingExemption,
    totalSkipTransfers,
    gstTaxExposure,
    estimatedGSTTax,
    transferSummary: transfers,
    advisoryNotes,
  }
}

export function applyIncomeTaxDrag(config: IncomeTaxDragConfig): IncomeTaxDragResult {
  const {
    annualTrustIncome,
    isGrantorTrust,
    grantorMarginalRate,
    projectionYears,
  } = config

  const advisoryNotes: string[] = []

  // Grantor trust: grantor pays at their marginal rate
  // Non-grantor trust: trust pays at compressed trust rates (37% bracket starts at ~$15,200 in 2026)
  const COMPRESSED_TRUST_RATE = 0.37
  const effectiveRate = isGrantorTrust ? grantorMarginalRate : COMPRESSED_TRUST_RATE

  const annualTaxCost = annualTrustIncome * effectiveRate
  const totalTaxOverPeriod = annualTaxCost * projectionYears
  const taxPaidBy: 'grantor' | 'trust' = isGrantorTrust ? 'grantor' : 'trust'

  // For grantor trusts, tax paid by grantor effectively reduces the taxable estate
  const additionalEstateDepleted = isGrantorTrust ? totalTaxOverPeriod : 0

  if (isGrantorTrust) {
    advisoryNotes.push(
      `Grantor trust: the grantor pays $${Math.round(annualTaxCost).toLocaleString()}/year in income tax ` +
      `on trust earnings. Over ${projectionYears} years this removes ` +
      `$${Math.round(totalTaxOverPeriod).toLocaleString()} from the taxable estate — ` +
      `effectively an additional tax-free gift.`
    )
  } else {
    advisoryNotes.push(
      `Non-grantor trust: the trust pays income tax at compressed trust rates (37% on income ` +
      `above ~$15,200). Annual tax cost: $${Math.round(annualTaxCost).toLocaleString()}. ` +
      `Consider grantor trust status to shift this tax burden to the grantor as a planning benefit.`
    )
  }

  return {
    annualTaxCost,
    taxPaidBy,
    totalTaxOverPeriod,
    additionalEstateDepleted,
    effectiveAfterTaxGrowthNote: isGrantorTrust
      ? 'Trust assets grow at pre-tax rate — grantor bears income tax externally.'
      : `Trust assets grow at after-tax rate (compressed ${(COMPRESSED_TRUST_RATE * 100).toFixed(0)}% bracket applies).`,
    advisoryNotes,
  }
}
