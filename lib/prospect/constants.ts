export const PROSPECT_ASSET_MIDPOINTS: Record<string, number> = {
  sm: 3_000_000,
  md: 10_000_000,
  lg: 22_500_000,
  xl: 35_000_000,
}

export const PROSPECT_RANGE_LABELS: Record<string, string> = {
  sm: '$1M–$5M',
  md: '$5M–$15M',
  lg: '$15M–$30M',
  xl: '$30M+',
}

export const PROSPECT_US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]

export function fmtProspectDollars(n: number): string {
  if (n === 0) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}
