/** Row shape from `strategy_line_items` — shared partition logic for trust-strategy page. */
export type StrategyLineItemDbRow = {
  id: string
  strategy_source: string | null
  amount: number | null
  sign: number | null
  confidence_level: string | null
  effective_year: number | null
  metadata: unknown
  scenario_name: string | null
  consumer_accepted: boolean | null
  consumer_rejected: boolean | null
  source_role: string | null
  consumer_withdrawn: boolean | null
  consumer_status: string | null
  reversed_from: string | null
  reversal_reason: string | null
  withdrawn_at: string | null
  is_active: boolean | null
}

/** Mirrors the three separate queries previously used on my-estate-trust-strategy. */
export function partitionStrategyLineItems(rows: StrategyLineItemDbRow[]) {
  const advisorLineItemRows = rows.filter(
    (row) => row.source_role === 'advisor' && row.is_active === true,
  )
  const consumerLineItemRows = rows.filter(
    (row) => row.source_role === 'consumer' && row.is_active === true,
  )
  const withdrawnLineItemRows = rows.filter(
    (row) => row.consumer_withdrawn === true && row.is_active === false,
  )
  return { advisorLineItemRows, consumerLineItemRows, withdrawnLineItemRows }
}
