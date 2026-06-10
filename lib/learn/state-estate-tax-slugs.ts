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
