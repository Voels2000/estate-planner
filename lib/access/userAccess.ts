export type UserAccess = {
  /** Effective feature tier (0–3) — single source via resolveEffectiveTier. */
  tier: number
  isAdvisor: boolean
  isAdvisorClient: boolean
  isAdmin: boolean
  isTrial: boolean
  subscriptionStatus: string | null
  /** App-managed trial end or Stripe period end for banner display. */
  trialEndsAt: string | null
}
