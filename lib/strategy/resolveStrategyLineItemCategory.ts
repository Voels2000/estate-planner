import type { StrategyLineItemCategory } from '@/lib/estate/types'

export const STRATEGY_LINE_ITEM_CATEGORIES: readonly StrategyLineItemCategory[] = [
  'liability',
  'valuation_discount',
  'trust_exclusion',
  'gifting',
  'marital',
  'charitable',
  'admin_expense',
] as const

const CATEGORY_BY_STRATEGY_SOURCE: Record<string, StrategyLineItemCategory> = {
  annual_gifting: 'gifting',
  lifetime_gifting: 'gifting',
  daf: 'charitable',
  crt: 'charitable',
  clat: 'charitable',
  ilit: 'trust_exclusion',
  grat: 'trust_exclusion',
  cst: 'trust_exclusion',
  revocable_trust: 'trust_exclusion',
  valuation_discount: 'valuation_discount',
  admin_expense: 'admin_expense',
  marital_deduction: 'marital',
  liquidity: 'liability',
  roth: 'trust_exclusion',
  slat: 'trust_exclusion',
  other: 'gifting',
}

export function resolveStrategyLineItemCategory(
  strategySource: string,
  category?: string | null,
): { ok: true; category: StrategyLineItemCategory } | { ok: false; error: string } {
  if (
    category &&
    (STRATEGY_LINE_ITEM_CATEGORIES as readonly string[]).includes(category)
  ) {
    return { ok: true, category: category as StrategyLineItemCategory }
  }

  const mapped = CATEGORY_BY_STRATEGY_SOURCE[strategySource]
  if (mapped) {
    return { ok: true, category: mapped }
  }

  return {
    ok: false,
    error: `Valid category required for strategy_source "${strategySource}"`,
  }
}
