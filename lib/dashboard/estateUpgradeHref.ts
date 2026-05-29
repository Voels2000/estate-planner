/** Routes that require Estate tier (3); tier 1/2 users are sent to the estate-tax upgrade wall. */
const ESTATE_TIER3_PREFIXES = [
  '/titling',
  '/estate-tax',
  '/my-estate-strategy',
  '/my-estate-trust-strategy',
  '/incapacity-planning',
  '/domicile-analysis',
  '/my-family',
  '/business-succession',
] as const

export const ESTATE_UPGRADE_WALL_HREF = '/estate-tax'

export function resolveEstateActionHref(href: string, consumerTier?: number): string {
  if (!consumerTier || consumerTier >= 3) return href
  const path = href.split('?')[0] ?? href
  if (ESTATE_TIER3_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return ESTATE_UPGRADE_WALL_HREF
  }
  return href
}

export function estateDetailsHref(consumerTier?: number): string {
  return consumerTier && consumerTier < 3 ? ESTATE_UPGRADE_WALL_HREF : '#estate-conflicts'
}
