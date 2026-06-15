/**
 * Washington estate tax regimes — date-of-death selection (Engine B).
 *
 * Launch (2026-06): Regime D only (ESB 6347, eff. 2026-07-01). A/B/C configs are
 * reserved for future wiring; planning deaths for living clients land on or after
 * July 1, 2026.
 *
 * Brackets: WA DOR restored legacy schedule (10%–20% on taxable estate above exemption).
 * Source: RCW 83.100.040; ESB 6347; aligned with state_estate_tax_content (2026-06).
 */

import type { StateBracket } from '@/lib/calculations/stateEstateTax'

export type WaRegimeId = 'A' | 'B' | 'C' | 'D'

export type WaMarginalBand = {
  /** Top of taxable-estate band (null = no upper cap). */
  upTo: number | null
  rate: number
}

export type WaRegime = {
  id: WaRegimeId
  /** Inclusive start date (UTC). */
  effectiveFrom: string
  exemption: number
  brackets: WaMarginalBand[]
  /** Human-readable statute note for UI disclaimers. */
  statuteNote: string
}

/** Shown on WA state-estate-tax surfaces (advisor + consumer). @deprecated Use waDisclaimers.ts */
export { WA_ESTATE_TAX_ESTIMATE_DISCLAIMER } from '@/lib/estate/waDisclaimers'

/** Regime D — ESB 6347 rollback (frozen $3.0M exemption, legacy 10%–20% table). */
export const WA_REGIME_D: WaRegime = {
  id: 'D',
  effectiveFrom: '2026-07-01',
  exemption: 3_000_000,
  statuteNote: 'ESB 6347 (eff. 2026-07-01)',
  brackets: [
    { upTo: 1_000_000, rate: 0.1 },
    { upTo: 2_000_000, rate: 0.14 },
    { upTo: 3_000_000, rate: 0.15 },
    { upTo: 4_000_000, rate: 0.16 },
    { upTo: 6_000_000, rate: 0.18 },
    { upTo: 7_000_000, rate: 0.19 },
    { upTo: 9_000_000, rate: 0.195 },
    { upTo: null, rate: 0.2 },
  ],
}

/** Ordered for future regime selection (D is last / current planning default). */
const WA_REGIMES: WaRegime[] = [WA_REGIME_D]

const REGIME_D_START_MS = Date.UTC(2026, 6, 1)

export function isWaState(stateCode: string | null | undefined): boolean {
  return String(stateCode ?? '').trim().toUpperCase() === 'WA'
}

/**
 * Select WA regime for a modeled date of death / effective date.
 * Launch: returns Regime D for all planning dates (including pre-July 2026 — see disclaimer).
 */
export function resolveWaRegime(dateOfDeath: Date = new Date()): WaRegime {
  void dateOfDeath
  // Future: walk WA_REGIMES by effectiveFrom when A/B/C are wired.
  if (dateOfDeath.getTime() >= REGIME_D_START_MS) return WA_REGIME_D
  // Pre-July 2026 historical deaths not modeled at launch; use D for forward planning consistency.
  return WA_REGIME_D
}

/** Convert regime marginal bands to Engine B `StateBracket` rows. */
export function waRegimeToStateBrackets(regime: WaRegime): StateBracket[] {
  let prev = 0
  return regime.brackets.map((band, index) => {
    const min_amount = prev
    const max_amount = band.upTo ?? 9_999_999_999
    prev = band.upTo ?? max_amount
    return {
      min_amount,
      max_amount,
      rate_pct: band.rate * 100,
      exemption_amount: regime.exemption,
    }
  })
}

/** Progressive WA tax on taxable estate (post-exemption) — for golden tests. */
export function calcWaTaxOnTaxableEstate(taxableEstate: number, regime: WaRegime = WA_REGIME_D): number {
  if (taxableEstate <= 0) return 0
  let tax = 0
  let prevTop = 0
  for (const band of regime.brackets) {
    const top = band.upTo ?? Infinity
    if (taxableEstate <= prevTop) break
    const width = top - prevTop
    const inBand = Math.min(taxableEstate, top) - prevTop
    if (inBand > 0) tax += inBand * band.rate
    prevTop = top
  }
  return Math.round(tax)
}

export function calcWaEstateTax(
  grossEstate: number,
  deductions = 0,
  regime: WaRegime = WA_REGIME_D,
): number {
  const taxable = Math.max(0, grossEstate - regime.exemption - deductions)
  return calcWaTaxOnTaxableEstate(taxable, regime)
}

/** Bypass trust funded at first death — min(exemption, first-spouse share). */
export function waBypassFundingAmount(
  grossEstate: number,
  firstSpouseShare?: number,
  regime: WaRegime = WA_REGIME_D,
): number {
  const share = firstSpouseShare ?? grossEstate / 2
  return Math.min(regime.exemption, Math.max(0, share))
}

/** Second-death WA tax with bypass/CST — taxable = max(0, (G − X) − exemption). */
export function calcWaEstateTaxWithBypass(
  grossEstate: number,
  firstSpouseShare?: number,
  regime: WaRegime = WA_REGIME_D,
): number {
  const funding = waBypassFundingAmount(grossEstate, firstSpouseShare, regime)
  const survivorEstate = Math.max(0, grossEstate - funding)
  return calcWaEstateTax(survivorEstate, 0, regime)
}

/** Snapshot planning benefit: without bypass minus with bypass (second death). */
export function calcWaBypassPlanningBenefit(
  grossEstate: number,
  firstSpouseShare?: number,
  regime: WaRegime = WA_REGIME_D,
): number {
  const without = calcWaEstateTax(grossEstate, 0, regime)
  const withBypass = calcWaEstateTaxWithBypass(grossEstate, firstSpouseShare, regime)
  return Math.max(0, without - withBypass)
}

export type WaStateEstateTaxRuleRow = {
  state: string
  tax_year: number
  min_amount: number
  max_amount: number
  rate_pct: number
  exemption_amount: number
  no_portability?: boolean
}

/** Full DB-shaped rows for StateTaxPanel / domicile surfaces. */
export function waRegimeToStateEstateTaxRuleRows(
  taxYears: number[],
  regime: WaRegime = WA_REGIME_D,
): WaStateEstateTaxRuleRow[] {
  const brackets = waRegimeToStateBrackets(regime)
  const rows: WaStateEstateTaxRuleRow[] = []
  for (const taxYear of taxYears) {
    for (const b of brackets) {
      rows.push({
        state: 'WA',
        tax_year: taxYear,
        min_amount: b.min_amount,
        max_amount: b.max_amount,
        rate_pct: b.rate_pct,
        exemption_amount: b.exemption_amount,
        no_portability: true,
      })
    }
  }
  return rows
}

/** Replace WA rows in fetched rule sets with Regime D brackets (Engine B + UI parity). */
export function mergeWaRegimeIntoStateEstateTaxRules<
  T extends { state: string; tax_year: number },
>(rules: T[], taxYears?: number[]): T[] {
  if (!rules.some((r) => isWaState(r.state))) {
    if (!taxYears?.some((y) => y > 0)) return rules
  }
  const years =
    taxYears && taxYears.length > 0
      ? taxYears
      : [
          ...new Set(
            rules.filter((r) => isWaState(r.state)).map((r) => Number(r.tax_year)),
          ),
        ]
  const waYears = new Set(years.length > 0 ? years : [new Date().getFullYear()])
  const filtered = rules.filter(
    (r) => !(isWaState(r.state) && waYears.has(Number(r.tax_year))),
  )
  return [...filtered, ...(waRegimeToStateEstateTaxRuleRows([...waYears]) as unknown as T[])]
}
