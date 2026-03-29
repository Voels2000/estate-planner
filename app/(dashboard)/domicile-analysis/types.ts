export type StateWithDays = { state: string; days_per_year: number }

export type DomicileAnalysisRow = Record<string, unknown> & {
  id?: string
  user_id?: string
  claimed_domicile_state?: string | null
  /** Legacy: string codes; current: rows with days per year */
  states?: string[] | StateWithDays[] | null
}

export type DomicileChecklistRow = {
  id: string
  analysis_id: string
  category: string
  item_key: string
  label: string
  description: string
  priority: string
  completed: boolean
  completed_at: string | null
}
