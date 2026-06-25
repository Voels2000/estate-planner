import { isAdvisorIdentity } from '@/lib/access/isAdvisorIdentity'

export type BillingExperience =
  | 'consumer'
  | 'firm_member'
  | 'firm_not_linked'
  | 'firm_owner'

/**
 * Which /billing surface to render — keyed on stored role, not capability flags.
 * Extracted for unit tests (superuser + consumer must not hit firm billing).
 */
export function resolveBillingExperience(input: {
  role: string | null | undefined
  isFirmOwner: boolean
  firmId: string | null
}): BillingExperience {
  if (!isAdvisorIdentity(input.role)) return 'consumer'
  if (!input.isFirmOwner) return 'firm_member'
  if (!input.firmId) return 'firm_not_linked'
  return 'firm_owner'
}
