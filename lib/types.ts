export type AdvisorTier = {
  id: string
  name: string
  stripe_price_id: string
  price_monthly: number
  client_limit: number | null
  display_order: number
  is_active: boolean
}
