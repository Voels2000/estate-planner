export type TrustRow = {
  id: string
  owner_id: string
  name: string
  excluded_from_estate?: unknown
  trust_type?: string
  grantor?: string | null
  trustee?: string | null
  funding_amount?: unknown
  state?: string | null
  is_irrevocable?: boolean
  excludes_from_estate?: boolean
  created_at?: string
  updated_at?: string
}

export type TrustWillRecommendation = {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
}

export type TrustWillChecklistItem = {
  task: string
  completed: boolean
}
