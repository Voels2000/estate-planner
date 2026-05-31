/**
 * Single source of truth for strategy type/source string values.
 * Import from here — never hardcode these strings at DB query or comparison call sites.
 *
 * @see docs/SPRINT_UNIFY_STATE_TAX.md Phase 0
 */

/** Values used in strategy_configs.strategy_type for credit shelter / bypass trust */
export const CST_STRATEGY_TYPES = ['cst', 'credit_shelter_trust', 'bypass_trust'] as const

/** Values used in strategy_line_items.strategy_source for credit shelter / bypass trust */
export const CST_STRATEGY_SOURCES = ['cst'] as const

/** Primary line-item source written when recommending a credit shelter trust */
export const CST_STRATEGY_SOURCE = CST_STRATEGY_SOURCES[0]

/** All known strategy_configs types (from DB / product catalog) */
export const STRATEGY_CONFIG_TYPES = [
  'gifting',
  'revocable_trust',
  'cst',
  'slat',
  'ilit',
  'grat',
  'crt',
  'clat',
  'daf',
  'roth_conversion',
] as const

export type CstStrategyType = (typeof CST_STRATEGY_TYPES)[number]
export type CstStrategySource = (typeof CST_STRATEGY_SOURCES)[number]
export type StrategyConfigType = (typeof STRATEGY_CONFIG_TYPES)[number]

export function isCstStrategyType(value: string | null | undefined): boolean {
  if (!value) return false
  return (CST_STRATEGY_TYPES as readonly string[]).includes(value)
}

export function isCstStrategySource(value: string | null | undefined): boolean {
  if (!value) return false
  return (CST_STRATEGY_SOURCES as readonly string[]).includes(value)
}

type StrategyLineItemBypassRow = {
  strategy_source?: string | null
  source_role?: string | null
  consumer_accepted?: boolean
  is_active?: boolean
  consumer_rejected?: boolean
}

/** Consumer horizons + advisor actual: CST only when consumer-owned or accepted. */
export function deriveHasBypassTrustFromLineItems(
  items: ReadonlyArray<StrategyLineItemBypassRow>,
  scope: 'consumer_accepted' | 'advisor_projected',
): boolean {
  return items.some((item) => {
    if (item.is_active === false || item.consumer_rejected) return false
    if (!isCstStrategySource(item.strategy_source)) return false
    if (scope === 'consumer_accepted') {
      return item.source_role === 'consumer' || Boolean(item.consumer_accepted)
    }
    return true
  })
}

/** Advisor modeling panels that persist to strategy_configs. */
export function deriveHasBypassTrustFromConfigs(
  configs: ReadonlyArray<{ strategy_type?: string | null; is_active?: boolean | null }>,
): boolean {
  return configs.some((c) => Boolean(c.is_active) && isCstStrategyType(c.strategy_type))
}
