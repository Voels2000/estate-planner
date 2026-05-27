/** Human-readable labels for strategy_line_items.strategy_source values. */

export const STRATEGY_LABELS: Record<string, string> = {
  annual_gifting: 'Annual Gifting Program',
  gifting: 'Annual Gifting Program',
  slat: 'Spousal Lifetime Access Trust (SLAT)',
  ilit: 'Irrevocable Life Insurance Trust (ILIT)',
  grat: 'Grantor Retained Annuity Trust (GRAT)',
  crt: 'Charitable Remainder Trust (CRT)',
  clat: 'Charitable Lead Annuity Trust (CLAT)',
  daf: 'Donor-Advised Fund (DAF)',
  charitable: 'Charitable Giving',
  roth: 'Roth Conversion',
  liquidity: 'Estate Liquidity Planning',
  cst: 'Credit Shelter Trust (CST)',
  credit_shelter_trust: 'Credit Shelter Trust (CST)',
  revocable_trust: 'Revocable Living Trust',
}

export function strategyLabel(source: string, scenarioName?: string | null): string {
  return scenarioName?.trim() || STRATEGY_LABELS[source] || source.replace(/_/g, ' ')
}
