// Sprint 69 — Liquidity Analysis Module
//
// Estate liquidity analysis determines whether a household has sufficient
// liquid assets to pay estate taxes without forcing a fire sale of illiquid
// assets (real estate, business interests, partnerships).
//
// Coverage ratio = liquid assets + ILIT death benefit / total estimated tax burden
// A ratio below 1.0 indicates a liquidity shortfall.

export interface LiquidityConfig {
  // Liquid assets: cash, marketable securities, money market
  liquidAssets: number
  // Illiquid assets: real estate, business interests, partnerships, private equity
  illiquidAssets: number
  // Estimated federal estate tax (from federal tax engine)
  estimatedFederalTax: number
  // Estimated state estate tax (from state tax engine)
  estimatedStateTax: number
  // ILIT death benefit available to pay taxes (if ILIT established)
  ilitDeathBenefit: number
  // Whether ILIT §2035 flag is active (death benefit may be included in estate)
  ilitSection2035Flag: boolean
  // Other liquidity sources (e.g. business buy-sell agreements)
  otherLiquiditySources: number
}

export interface LiquidityResult {
  // Total estimated tax burden
  totalTaxBurden: number
  // Total available liquidity (liquid assets + ILIT + other)
  totalLiquidity: number
  // Coverage ratio (totalLiquidity / totalTaxBurden)
  coverageRatio: number
  // Shortfall (negative = problem)
  shortfall: number
  // Whether there is a liquidity problem
  hasLiquidityShortfall: boolean
  // Percentage of estate that is illiquid
  illiquidPct: number
  // Recommended ILIT death benefit to cover shortfall (if applicable)
  recommendedILITCoverage: number
  // Advisory notes
  advisoryNotes: string[]
}

export function analyzeLiquidity(config: LiquidityConfig): LiquidityResult {
  const {
    liquidAssets,
    illiquidAssets,
    estimatedFederalTax,
    estimatedStateTax,
    ilitDeathBenefit,
    ilitSection2035Flag,
    otherLiquiditySources,
  } = config

  const advisoryNotes: string[] = []

  const totalTaxBurden = estimatedFederalTax + estimatedStateTax
  const effectiveILIT = ilitSection2035Flag ? 0 : ilitDeathBenefit
  const totalLiquidity = liquidAssets + effectiveILIT + otherLiquiditySources
  const totalEstate = liquidAssets + illiquidAssets
  const illiquidPct = totalEstate > 0 ? illiquidAssets / totalEstate : 0

  const coverageRatio = totalTaxBurden > 0 ? totalLiquidity / totalTaxBurden : 999
  const shortfall = totalLiquidity - totalTaxBurden
  const hasLiquidityShortfall = shortfall < 0

  // Recommended ILIT death benefit to cover any shortfall
  const recommendedILITCoverage = hasLiquidityShortfall
    ? Math.abs(shortfall)
    : 0

  // Advisory notes
  if (hasLiquidityShortfall) {
    advisoryNotes.push(
      `⚠️ Liquidity Shortfall: Available liquidity of $${Math.round(totalLiquidity).toLocaleString()} ` +
      `covers only ${(coverageRatio * 100).toFixed(0)}% of the estimated $${Math.round(totalTaxBurden).toLocaleString()} ` +
      `tax burden. Shortfall: $${Math.round(Math.abs(shortfall)).toLocaleString()}.`
    )
    advisoryNotes.push(
      `Recommended solution: establish an ILIT with a death benefit of at least ` +
      `$${Math.round(recommendedILITCoverage).toLocaleString()} to cover the liquidity gap without ` +
      `forcing a distressed sale of illiquid assets.`
    )
  } else {
    advisoryNotes.push(
      `Liquidity coverage ratio: ${coverageRatio.toFixed(2)}x. ` +
      `Available liquidity of $${Math.round(totalLiquidity).toLocaleString()} is sufficient ` +
      `to cover the estimated tax burden of $${Math.round(totalTaxBurden).toLocaleString()}.`
    )
  }

  if (illiquidPct > 0.5) {
    advisoryNotes.push(
      `${(illiquidPct * 100).toFixed(0)}% of the gross estate is illiquid. ` +
      `High illiquidity concentration increases the risk of a forced asset sale to pay estate taxes. ` +
      `Consider life insurance or installment payment election (IRC §6166) for business interests.`
    )
  }

  if (ilitSection2035Flag && ilitDeathBenefit > 0) {
    advisoryNotes.push(
      `⚠️ ILIT §2035 flag is active — the ILIT death benefit of ` +
      `$${ilitDeathBenefit.toLocaleString()} is excluded from liquidity analysis. ` +
      `Establish the ILIT more than 3 years before the projected death year.`
    )
  }

  if (totalTaxBurden === 0) {
    advisoryNotes.push(
      `No estate tax is projected under the current scenario. ` +
      `Liquidity analysis becomes critical under a no-exemption stress scenario — run this analysis with the No Exemption stress scenario selected in the Tax tab.`
    )
  }

  return {
    totalTaxBurden,
    totalLiquidity,
    coverageRatio,
    shortfall,
    hasLiquidityShortfall,
    illiquidPct,
    recommendedILITCoverage,
    advisoryNotes,
  }
}
