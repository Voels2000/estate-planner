import type { SignupAdmissionPayload } from '@/lib/auth/signupAdmission'
import type { SignupRole } from '@/lib/auth/signupAdmission'

/** Minimum password length for open self-serve consumer signup. */
export const SIGNUP_PASSWORD_MIN_OPEN = 8

/** Minimum password length for invite/token signups (consumer paths). */
export const SIGNUP_PASSWORD_MIN_INVITE = 8

/** Minimum password length for advisor/attorney signups (higher blast radius). */
export const SIGNUP_PASSWORD_MIN_PRIVILEGED = 10

function admissionImpliesPrivilegedRole(admission: SignupAdmissionPayload): boolean {
  return (
    admission.type === 'open_advisor' ||
    admission.type === 'open_attorney' ||
    admission.type === 'advisor_connect' ||
    admission.type === 'attorney_connection' ||
    admission.type === 'firm_member_invite'
  )
}

export function signupPasswordMinLength(
  admission: SignupAdmissionPayload,
  role?: SignupRole,
): number {
  if (admission.type === 'open_consumer') return SIGNUP_PASSWORD_MIN_OPEN
  const effectiveRole = role ?? (admissionImpliesPrivilegedRole(admission) ? 'advisor' : 'consumer')
  if (effectiveRole === 'advisor' || effectiveRole === 'attorney') {
    return SIGNUP_PASSWORD_MIN_PRIVILEGED
  }
  return SIGNUP_PASSWORD_MIN_INVITE
}

export function validateSignupPassword(
  password: string,
  admission: SignupAdmissionPayload,
  role?: SignupRole,
): string | null {
  if (!password) return 'Password is required'
  const min = signupPasswordMinLength(admission, role)
  if (password.length < min) {
    return `Password must be at least ${min} characters`
  }
  return null
}

/** Safe in-app redirect only — blocks protocol-relative and external URLs. */
export function sanitizeSignupRedirect(redirectTo: string | undefined): string | undefined {
  const trimmed = redirectTo?.trim() ?? ''
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return undefined
  if (trimmed.includes('://')) return undefined
  return trimmed
}
