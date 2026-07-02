import type { SupabaseClient, User } from '@supabase/supabase-js'
import { isAdvisorOwnPlanPath } from '@/lib/access/advisorBillingGate'
import { userHasVerifiedTotpFactor } from '@/lib/security/privilegedMfaPolicy'

/** Claim v2: step-up at first sensitive action, not at portal entry. */
export function isActionGatedStepUpEnabled(): boolean {
  return process.env.ACTION_GATED_PRIVILEGED_MFA === 'true'
}

export type ActionStepUpProfile = {
  role?: string | null
}

export function pathnameRequiresActionStepUp(
  pathname: string,
  profile: ActionStepUpProfile,
): boolean {
  if (profile.role === 'attorney') {
    return (
      pathname.startsWith('/attorney/clients') || pathname.startsWith('/attorney/requests')
    )
  }
  if (profile.role === 'advisor') {
    return isAdvisorOwnPlanPath(pathname)
  }
  return false
}

export function isActionStepUpFlowPath(pathname: string): boolean {
  return (
    pathname === '/security-step-up' ||
    pathname === '/mfa-enroll' ||
    pathname === '/mfa-challenge' ||
    pathname.startsWith('/auth/')
  )
}

export function userCompletedSecurityStepUp(user: Pick<User, 'user_metadata'> | null): boolean {
  const stepUpAt = user?.user_metadata?.security_step_up_at
  return typeof stepUpAt === 'string' && stepUpAt.length > 0
}

/** Password + TOTP recorded via /security-step-up (flag off → always satisfied). */
export async function actionStepUpSatisfied(
  supabase: SupabaseClient,
  user: Pick<User, 'user_metadata'>,
): Promise<boolean> {
  if (!isActionGatedStepUpEnabled()) return true
  if (!userCompletedSecurityStepUp(user)) return false
  return userHasVerifiedTotpFactor(supabase)
}
