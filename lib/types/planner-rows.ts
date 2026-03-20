/**
 * Types for Supabase planner tables (assets, liabilities, income, expenses).
 * Use these when typing query results from the dashboard/projection APIs.
 */

/** Row shape when selecting: id, type, value, owner */
export type AssetRowSelect = {
  id: string
  type: string
  value: number
  owner: string
}

/** Row shape when selecting: id, type, balance, monthly_payment, interest_rate, owner */
export type LiabilityRowSelect = {
  id: string
  type: string
  balance: number
  monthly_payment: number | null
  interest_rate: number | null
  owner: string
}

/** Row shape when selecting: id, source, amount, start_year, end_year, inflation_adjust, owner */
export type IncomeRowSelect = {
  id: string
  source: string
  amount: number
  start_year: number | null
  end_year: number | null
  inflation_adjust: boolean
  ss_person: string | null
}

/** Row shape when selecting: id, category, amount, inflation_adjust, owner */
export type ExpenseRowSelect = {
  id: string
  category: string
  amount: number
  start_year: number | null
  end_year: number | null
  inflation_adjust: boolean
  owner: string
}
