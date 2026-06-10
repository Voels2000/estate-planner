/** Maps URL slug → state_code (e.g. /learn/oregon-estate-tax → OR) */
export const STATE_SLUG_MAP: Record<string, string> = {
  'washington-estate-tax': 'WA',
  'oregon-estate-tax': 'OR',
  'massachusetts-estate-tax': 'MA',
  'maryland-estate-tax': 'MD',
  'illinois-estate-tax': 'IL',
  'minnesota-estate-tax': 'MN',
  'new-york-estate-tax': 'NY',
  'connecticut-estate-tax': 'CT',
  'maine-estate-tax': 'ME',
  'rhode-island-estate-tax': 'RI',
  'vermont-estate-tax': 'VT',
  'hawaii-estate-tax': 'HI',
  'dc-estate-tax': 'DC',
}

export const STATE_SLUGS = Object.keys(STATE_SLUG_MAP)

const CODE_TO_SLUG = Object.fromEntries(
  Object.entries(STATE_SLUG_MAP).map(([slug, code]) => [code, slug]),
) as Record<string, string>

export function stateCodeToSlug(stateCode: string): string | undefined {
  return CODE_TO_SLUG[stateCode.toUpperCase()]
}

export function stateGuidePath(stateCode: string): string | undefined {
  const slug = stateCodeToSlug(stateCode)
  return slug ? `/learn/${slug}` : undefined
}

/** Plain-language risk hook for /learn index cards — static copy, not admin-edited */
export const RISK_SUMMARY: Record<string, string> = {
  WA: 'Exemption frozen at $3M — home appreciation alone can trigger exposure',
  OR: 'Lowest exemption in the US at $1M — catches most homeowners with retirement savings',
  MA: 'Cliff effect: estates over $2M owe tax on the entire amount, not just the excess',
  NY: 'Cliff effect above $7.16M — estates just over the threshold face a large tax jump',
  MD: 'Double exposure: both estate tax and a separate inheritance tax',
  IL: '$4M exemption with no portability between spouses',
  MN: '$3M exemption, inflation-adjusted — includes some out-of-state property',
  RI: 'Low $1.77M exemption, inflation-adjusted annually',
  VT: 'Flat 16% on everything above $5M — straightforward but steep',
  CT: 'Matches federal exemption at $13.6M — narrower audience, but 12% top rate',
  ME: 'Generous $6.8M exemption with relatively low 12% top rate',
  HI: "Only state with portability — surviving spouse can use deceased spouse's exemption",
  DC: 'Indexed annually; affects high-value DC real estate estates',
}

export function getRiskSummary(stateCode: string): string | undefined {
  return RISK_SUMMARY[stateCode.toUpperCase()]
}
