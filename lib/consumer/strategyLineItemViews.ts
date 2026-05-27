/** Split active strategy_line_items into sandbox vs in-plan buckets for consumer UI. */

export type StrategyLineItemRow = {
  id: string
  strategy_source: string
  source_role: 'consumer' | 'advisor'
  confidence_level: string
  amount: number | null
  scenario_name: string | null
  consumer_accepted: boolean
  consumer_rejected: boolean
  effective_year?: number | null
}

export function partitionStrategyLineItems(items: StrategyLineItemRow[]): {
  sandbox: StrategyLineItemRow[]
  confirmed: StrategyLineItemRow[]
} {
  const sandbox: StrategyLineItemRow[] = []
  const confirmed: StrategyLineItemRow[] = []

  for (const item of items) {
    if (item.consumer_rejected) continue

    const isConfirmed =
      item.confidence_level === 'probable' ||
      item.confidence_level === 'certain' ||
      (item.source_role === 'advisor' && item.consumer_accepted)

    if (isConfirmed) {
      confirmed.push(item)
    } else if (item.confidence_level === 'illustrative') {
      sandbox.push(item)
    }
  }

  return { sandbox, confirmed }
}
