// Sprint 67 — Gifting Strategy Module
// Applies an annual gifting program to a projection scenario
// Handles §2035 three-year rule: gifts made within 3 years of death
// are pulled back into the gross estate for federal estate tax purposes.

import { ProjectionScenario } from '@/lib/types/projection-scenario'

export interface GiftingProgramConfig {
  // Annual gift amount per donor (not per recipient)
  annualGiftPerDonor: number
  // Number of recipients (e.g. 3 children = 3)
  numberOfRecipients: number
  // Year gifting program starts (e.g. 2025)
  startYear: number
  // Year gifting program ends — undefined means runs to death
  endYear?: number
  // Whether to use both spouses as donors (doubles annual exclusion)
  giftSplitting: boolean
}

export interface GiftingProgramResult {
  // Total gifts removed from gross estate (excluding §2035 clawback)
  totalGiftsOut: number
  // Amount clawed back under §2035 (gifts within 3 years of death)
  section2035Clawback: number
  // Net estate reduction
  netEstateReduction: number
  // §2035 flag: true if any gifts fall within 3 years of death year
  section2035Flag: boolean
  // Year-by-year gift amounts
  giftsByYear: Record<number, number>
  // Warning message if §2035 applies
  section2035Warning?: string
}

// Annual federal gift tax exclusion — sourced from federal_tax_config
// Current law: $18,000 per recipient per donor (2024, inflation-indexed)
const ANNUAL_EXCLUSION_PER_DONOR_PER_RECIPIENT = 18000

export function applyGiftingProgram(
  scenario: ProjectionScenario,
  config: GiftingProgramConfig,
  deathYear: number,
  lawScenario: 'current_law' | 'no_exemption' = 'current_law'
): GiftingProgramResult {
  void scenario
  void lawScenario

  const {
    annualGiftPerDonor,
    numberOfRecipients,
    startYear,
    endYear,
    giftSplitting,
  } = config

  const donors = giftSplitting ? 2 : 1
  const maxAnnualExclusion = ANNUAL_EXCLUSION_PER_DONOR_PER_RECIPIENT * numberOfRecipients * donors

  // Cap gift at annual exclusion to stay within exclusion (taxable gifts handled separately)
  const annualGift = Math.min(annualGiftPerDonor * donors * numberOfRecipients, maxAnnualExclusion)

  const programEndYear = endYear ?? deathYear - 1
  const giftsByYear: Record<number, number> = {}

  let totalGiftsOut = 0
  let section2035Clawback = 0

  for (let year = startYear; year <= programEndYear; year++) {
    if (year >= deathYear) break
    giftsByYear[year] = annualGift
    totalGiftsOut += annualGift

    // §2035 three-year rule: gifts within 3 years of death pulled back into gross estate
    if (year >= deathYear - 3) {
      section2035Clawback += annualGift
    }
  }

  const section2035Flag = section2035Clawback > 0
  const netEstateReduction = totalGiftsOut - section2035Clawback

  return {
    totalGiftsOut,
    section2035Clawback,
    netEstateReduction,
    section2035Flag,
    giftsByYear,
    section2035Warning: section2035Flag
      ? `§2035 three-year rule applies: $${section2035Clawback.toLocaleString()} in gifts made within 3 years of the selected death year will be included in the gross estate.`
      : undefined,
  }
}
