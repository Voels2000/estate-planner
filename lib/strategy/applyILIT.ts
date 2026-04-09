// Sprint 68 — Irrevocable Life Insurance Trust (ILIT) Module
//
// An ILIT owns a life insurance policy. The death benefit is excluded from
// the insured's gross estate if the ILIT has been established for more than
// 3 years (§2035 three-year rule).
//
// Key calculations:
//   - IRR: internal rate of return on premiums vs death benefit
//   - §2035 flag: policy transferred to ILIT within 3 years of death
//     causes death benefit to be pulled back into gross estate
//   - Crummey notice: annual premium payments to ILIT must use Crummey
//     powers to qualify as present-interest gifts

export interface ILITConfig {
  // Annual premium paid into the ILIT
  annualPremium: number
  // Death benefit of the policy
  deathBenefit: number
  // Policy term in years (0 = permanent/whole life)
  policyTermYears: number
  // Year ILIT was established (or will be established)
  establishmentYear: number
  // Projected death year
  deathYear: number
  // Number of Crummey beneficiaries (determines max annual exclusion usage)
  crummeyBeneficiaries: number
  // Whether policy was transferred into ILIT (vs. ILIT purchasing new policy)
  isPolicyTransfer: boolean
}

export interface ILITResult {
  // Whether §2035 applies (policy within 3 years of death)
  section2035Flag: boolean
  // Death benefit included in gross estate if §2035 applies
  section2035InclusionAmount: number
  // Estate tax saved by keeping death benefit outside estate (at 40%)
  estateTaxSaved: number
  // IRR of premiums vs death benefit (annualized)
  irrPct: number
  // Total premiums paid over projection period
  totalPremiumsPaid: number
  // Annual Crummey notice amount per beneficiary
  crummeyAmountPerBeneficiary: number
  // Whether premiums fit within annual exclusion (no taxable gifts)
  premiumsWithinExclusion: boolean
  // Advisory notes
  advisoryNotes: string[]
}

// Annual gift tax exclusion per recipient (2024, indexed)
const ANNUAL_EXCLUSION = 18000
const ESTATE_TAX_RATE = 0.4

// Simple IRR approximation for level premium vs lump sum death benefit
function calculateIRR(
  annualPremium: number,
  deathBenefit: number,
  years: number
): number {
  if (years <= 0 || annualPremium <= 0) return 0

  // NPV function: sum of discounted premiums = discounted death benefit
  const npv = (rate: number): number => {
    let pv = 0
    for (let t = 1; t <= years; t++) {
      pv += annualPremium / Math.pow(1 + rate, t)
    }
    return deathBenefit / Math.pow(1 + rate, years) - pv
  }

  // Binary search for IRR between -50% and 200%
  let low = -0.5
  let high = 2.0
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2
    if (npv(mid) > 0) low = mid
    else high = mid
    if (high - low < 0.0001) break
  }
  return (low + high) / 2
}

export function applyILIT(config: ILITConfig): ILITResult {
  const {
    annualPremium,
    deathBenefit,
    policyTermYears,
    establishmentYear,
    deathYear,
    crummeyBeneficiaries,
    isPolicyTransfer,
  } = config

  const advisoryNotes: string[] = []
  const yearsOfPremiums = deathYear - establishmentYear
  const totalPremiumsPaid = annualPremium * Math.max(0, yearsOfPremiums)

  // §2035: if ILIT established within 3 years of death, death benefit included in estate
  const section2035Flag = isPolicyTransfer
    ? deathYear - establishmentYear <= 3
    : false

  const section2035InclusionAmount = section2035Flag ? deathBenefit : 0
  const estateTaxSaved = section2035Flag ? 0 : deathBenefit * ESTATE_TAX_RATE

  // IRR calculation
  const effectiveYears = policyTermYears > 0
    ? Math.min(policyTermYears, yearsOfPremiums)
    : yearsOfPremiums
  const irrPct = calculateIRR(annualPremium, deathBenefit, effectiveYears)

  // Crummey notice analysis
  const crummeyAmountPerBeneficiary = crummeyBeneficiaries > 0
    ? annualPremium / crummeyBeneficiaries
    : annualPremium
  const premiumsWithinExclusion = crummeyAmountPerBeneficiary <= ANNUAL_EXCLUSION

  if (section2035Flag) {
    advisoryNotes.push(
      `⚠️ §2035 Three-Year Rule: The policy was transferred to the ILIT within 3 years of the ` +
      `selected death year. The full death benefit of $${deathBenefit.toLocaleString()} will be ` +
      `included in the gross estate. Establish ILITs early — the ILIT should purchase a new policy ` +
      `rather than receiving a transfer whenever possible.`
    )
  } else {
    advisoryNotes.push(
      `ILIT excludes $${deathBenefit.toLocaleString()} death benefit from gross estate, ` +
      `saving approximately $${Math.round(estateTaxSaved).toLocaleString()} in estate tax at the 40% rate.`
    )
  }

  if (!premiumsWithinExclusion) {
    advisoryNotes.push(
      `Annual premium of $${annualPremium.toLocaleString()} divided among ${crummeyBeneficiaries} ` +
      `Crummey beneficiaries = $${Math.round(crummeyAmountPerBeneficiary).toLocaleString()} per beneficiary. ` +
      `This exceeds the $${ANNUAL_EXCLUSION.toLocaleString()} annual exclusion. ` +
      `Excess premiums will use lifetime exemption or trigger gift tax.`
    )
  } else {
    advisoryNotes.push(
      `Premiums qualify as present-interest gifts via Crummey powers. ` +
      `$${Math.round(crummeyAmountPerBeneficiary).toLocaleString()} per beneficiary is within the ` +
      `$${ANNUAL_EXCLUSION.toLocaleString()} annual exclusion — no lifetime exemption consumed.`
    )
  }

  advisoryNotes.push(
    `Policy IRR: ${(irrPct * 100).toFixed(1)}% annualized over ${effectiveYears} years. ` +
    `Total premiums paid: $${Math.round(totalPremiumsPaid).toLocaleString()}.`
  )

  return {
    section2035Flag,
    section2035InclusionAmount,
    estateTaxSaved,
    irrPct,
    totalPremiumsPaid,
    crummeyAmountPerBeneficiary,
    premiumsWithinExclusion,
    advisoryNotes,
  }
}
