/**
 * States whose estate/income brackets are prefetched for advisor client datasets
 * (domicile breakeven, multi-state comparisons). Always includes household primary.
 */

import { MODELED_ESTATE_TAX_STATES } from '@/lib/calculations/stateEstateTax'

export function buildAdvisorStatesToFetch(
  householdStatePrimary: string | null | undefined,
  extraStates: string[] = [],
): string[] {
  const normalized = [
    ...MODELED_ESTATE_TAX_STATES,
    householdStatePrimary,
    ...extraStates,
  ]
    .map((s) => (typeof s === 'string' ? s.trim().toUpperCase() : ''))
    .filter((s) => s.length === 2)

  return [...new Set(normalized)]
}
