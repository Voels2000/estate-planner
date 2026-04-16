// lib/tax/estate-tax-constants.ts
// Federal estate & gift tax constants — OBBBA 2026 regime.
// Source: One Big Beautiful Bill Act (P.L. 119-21, signed July 4, 2025).
// IRS Rev. Proc. 2025 inflation adjustments (October 9, 2025).
//
// These numbers are the single source of truth for federal estate & gift
// tax constants. Do not hardcode them anywhere else in the codebase.
// If federal law changes, update only this file.

export const OBBBA_2026 = {
  /** Basic exclusion amount — single filer, 2026 */
  BASIC_EXCLUSION_SINGLE: 15_000_000,
  /** Basic exclusion amount — married filing jointly, 2026 (with portability) */
  BASIC_EXCLUSION_MFJ: 30_000_000,
  /** GST exemption — matches basic exclusion; not portable between spouses */
  GST_EXEMPTION: 15_000_000,
  /** Annual per-recipient gift exclusion, 2026 (unchanged from 2025) */
  ANNUAL_GIFT_EXCLUSION: 19_000,
  /** Annual per-recipient gift exclusion when spouses elect split-gifting (Form 709) */
  ANNUAL_GIFT_EXCLUSION_SPLIT: 38_000,
  /** 529 superfund (5-year acceleration) — single filer, per beneficiary */
  SUPERFUND_529_INDIVIDUAL: 95_000,
  /** 529 superfund (5-year acceleration) — couple, per beneficiary */
  SUPERFUND_529_COUPLE: 190_000,
  /** Annual exclusion for gifts to a non-US-citizen spouse, 2026 */
  NON_CITIZEN_SPOUSE_ANNUAL: 194_000,
  /** Top marginal federal estate tax rate (unchanged by OBBBA) */
  TOP_RATE: 0.40,
} as const

/**
 * Law scenarios displayed in the advisor Strategy tab and Tax tab.
 * Sunset / Post-2025 was removed in Session 20 — OBBBA eliminated it.
 */
export type EstateScenario = 'current_law' | 'no_exemption'

export type FilingStatus = 'single' | 'mfj'

/**
 * Look up the federal estate tax exemption for a given scenario.
 *
 * - current_law: OBBBA basic exclusion ($15M single / $30M MFJ)
 * - no_exemption: zero (stress test for planning conversations)
 */
export function getExemptionForScenario(
  scenario: EstateScenario,
  filingStatus: FilingStatus,
): number {
  if (scenario === 'no_exemption') return 0
  return filingStatus === 'mfj'
    ? OBBBA_2026.BASIC_EXCLUSION_MFJ
    : OBBBA_2026.BASIC_EXCLUSION_SINGLE
}
