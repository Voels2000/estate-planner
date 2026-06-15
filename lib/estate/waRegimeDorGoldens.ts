/**
 * WA DOR Table W golden vectors — dates of death July 1, 2026 and after.
 * Source: https://dor.wa.gov/taxes-rates/other-taxes/estate-tax-tables
 * Statute: RCW 83.100.040 (ESB 6347 rollback, eff. 2026-07-01)
 *
 * Taxable estate = gross estate minus exemption (and deductions). Bands apply to
 * taxable amount above $0, not gross.
 */

/** Cumulative tax at top of each DOR band (taxable estate). */
export const WA_DOR_TABLE_W_TAXABLE_GOLDENS = [
  { taxableEstate: 1_000_000, expectedTax: 100_000, band: '$0–$1M @ 10%' },
  { taxableEstate: 4_000_000, expectedTax: 550_000, band: '$3–$4M @ 16% cumulative' },
  { taxableEstate: 6_000_000, expectedTax: 910_000, band: '$4–$6M @ 18% cumulative' },
  { taxableEstate: 7_000_000, expectedTax: 1_100_000, band: '$6–$7M @ 19% cumulative' },
  { taxableEstate: 9_000_000, expectedTax: 1_490_000, band: '$7–$9M @ 19.5% cumulative' },
  { taxableEstate: 10_000_000, expectedTax: 1_690_000, band: '$9M+ @ 20% ($1M in top band)' },
] as const

/** Gross-estate golden: $12M gross, single $3M exemption → $9M taxable. */
export const WA_DOR_HIGH_GROSS_GOLDEN = {
  grossEstate: 12_000_000,
  exemption: 3_000_000,
  taxableEstate: 9_000_000,
  stateTaxWithoutBypass: 1_490_000,
  _comment: 'Exercises $7M–$9M (19.5%) and $9M+ (20%) bands — Voels-scale estates do not.',
} as const
