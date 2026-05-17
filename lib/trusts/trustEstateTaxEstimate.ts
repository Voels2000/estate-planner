export type StateEstateBracketRow = {
  min_amount: number
  max_amount: number | null
  rate_pct: number
}

/** Marginal state estate rate (%) for the bracket that contains `estateValue`. */
export function marginalStateEstateRatePct(
  brackets: StateEstateBracketRow[],
  estateValue: number,
): number {
  if (!brackets.length || estateValue <= 0) return 0
  const sorted = [...brackets].sort((a, b) => a.min_amount - b.min_amount)
  let rate = sorted[0]?.rate_pct ?? 0
  for (const bracket of sorted) {
    if (estateValue >= bracket.min_amount) {
      rate = bracket.rate_pct
    }
  }
  return rate
}

export function estimateTrustTaxSaved(fundingAmount: number, ratePct: number): number {
  if (fundingAmount <= 0 || ratePct <= 0) return 0
  return Math.round(fundingAmount * (ratePct / 100))
}
