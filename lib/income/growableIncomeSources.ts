/** Income sources that may use per-record annual_growth_rate in projections. */
export const GROWABLE_INCOME_SOURCES = [
  'salary',
  'self_employment',
  'equity_awards',
  'business',
  'rental',
] as const

export type GrowableIncomeSource = (typeof GROWABLE_INCOME_SOURCES)[number]

export function isGrowableIncomeSource(source: string): source is GrowableIncomeSource {
  return (GROWABLE_INCOME_SOURCES as readonly string[]).includes(source)
}
