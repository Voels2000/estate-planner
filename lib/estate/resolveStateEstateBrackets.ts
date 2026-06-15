import type { StateBracket } from '@/lib/calculations/stateEstateTax'
import {
  isWaState,
  resolveWaRegime,
  waRegimeToStateBrackets,
} from '@/lib/estate/waRegime'

export function mapStateEstateTaxRuleRows(
  rows: Array<Record<string, unknown>>,
): StateBracket[] {
  return rows.map((r) => ({
    min_amount: Number(r.min_amount ?? 0),
    max_amount: r.max_amount != null ? Number(r.max_amount) : 9_999_999_999,
    rate_pct: Number(r.rate_pct ?? 0),
    exemption_amount: Number(r.exemption_amount ?? 0),
  }))
}

/**
 * Resolve Engine B brackets for a state. WA uses dated regime config (not DB drift).
 */
export function resolveStateEstateBrackets(params: {
  stateCode: string | null | undefined
  dbBrackets: StateBracket[]
  /** Modeled date of death or effective date; defaults to today. */
  effectiveDate?: Date
}): StateBracket[] {
  if (!isWaState(params.stateCode)) return params.dbBrackets
  const regime = resolveWaRegime(params.effectiveDate ?? new Date())
  return waRegimeToStateBrackets(regime)
}

/** Map DB rows then apply WA regime override when applicable. */
export function mapAndResolveStateEstateBrackets(params: {
  stateCode: string | null | undefined
  rows: Array<Record<string, unknown>>
  effectiveDate?: Date
}): StateBracket[] {
  const db = mapStateEstateTaxRuleRows(params.rows)
  return resolveStateEstateBrackets({
    stateCode: params.stateCode,
    dbBrackets: db,
    effectiveDate: params.effectiveDate,
  })
}
