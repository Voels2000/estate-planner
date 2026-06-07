import type { SupabaseClient } from '@supabase/supabase-js'

/** When true, admin/advisor/attorney accounts must enroll TOTP before using privileged surfaces. */
export function isPrivilegedMfaEnforcementEnabled(): boolean {
  return process.env.REQUIRE_PRIVILEGED_MFA === 'true'
}

export type PrivilegedMfaProfile = {
  role?: string | null
  is_admin?: boolean | null
  is_superuser?: boolean | null
}

export function profileRequiresPrivilegedMfa(profile: PrivilegedMfaProfile): boolean {
  if (profile.is_superuser === true || profile.is_admin === true) return true
  if (profile.role === 'advisor') return true
  if (profile.role === 'attorney') return true
  return false
}

export async function userHasVerifiedTotpFactor(
  supabase: SupabaseClient,
): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) return false
  return (data?.totp ?? []).some((factor) => factor.status === 'verified')
}

/** True when MFA enforcement is off, user is not privileged, or TOTP is enrolled. */
export async function privilegedMfaSatisfied(
  supabase: SupabaseClient,
  profile: PrivilegedMfaProfile,
): Promise<boolean> {
  if (!isPrivilegedMfaEnforcementEnabled()) return true
  if (!profileRequiresPrivilegedMfa(profile)) return true
  return userHasVerifiedTotpFactor(supabase)
}
