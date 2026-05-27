import type { StrategyLineItemInput } from '@/lib/estate/types'

/** Named consumer scenario for SLAT/ILIT and other single-plan strategy rows. */
export const CONSUMER_BASE_SCENARIO_NAME = 'base'

export type ConsumerStrategySaveInput = Omit<
  StrategyLineItemInput,
  'household_id' | 'source_role' | 'scenario_name' | 'metric_target'
> & {
  scenario_name?: string
  metric_target?: StrategyLineItemInput['metric_target']
}

export async function saveConsumerStrategyLineItem(
  householdId: string,
  input: ConsumerStrategySaveInput,
): Promise<void> {
  const res = await fetch('/api/strategy-line-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      household_id: householdId,
      source_role: 'consumer',
      scenario_name: input.scenario_name ?? CONSUMER_BASE_SCENARIO_NAME,
      sign: input.sign ?? -1,
      confidence_level: input.confidence_level ?? 'illustrative',
      metric_target: input.metric_target ?? 'taxable_estate',
      scenario_id: input.scenario_id ?? 'current_law',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Failed to save strategy')
  }
}

export async function promoteStrategyToProbable(id: string): Promise<void> {
  const res = await fetch('/api/strategy-line-items', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, promoteConfidence: true }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to promote strategy')
  }
}

export async function deactivateStrategyLineItemById(id: string): Promise<void> {
  const res = await fetch('/api/strategy-line-items', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Failed to remove strategy')
  }
}

export async function removeConsumerStrategyLineItem(
  householdId: string,
  strategySource: string,
  scenarioName = CONSUMER_BASE_SCENARIO_NAME,
): Promise<void> {
  const res = await fetch('/api/strategy-line-items', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      householdId,
      strategySource,
      scenarioName,
      source_role: 'consumer',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Failed to remove strategy')
  }
}
