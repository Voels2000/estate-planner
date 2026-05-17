import { redirect } from 'next/navigation'
import {
  isMinimumViableProfile,
  type ProfileGateHousehold,
  type ProfileGateMissingField,
} from '@/lib/estate/profileGate'

const ALL_MISSING: ProfileGateMissingField[] = [
  'state_primary',
  'filing_status',
  'date_of_birth_1',
]

export function profileRequiredUrl(fromPath: string, missing: ProfileGateMissingField[]): string {
  const params = new URLSearchParams({
    required: 'true',
    missing: missing.join(','),
    from: fromPath,
  })
  return `/profile?${params.toString()}`
}

/** Redirect to profile when household lacks minimum fields for estate planning pages. */
export function requireMinimumViableProfile(
  household: ProfileGateHousehold | null | undefined,
  fromPath: string,
): void {
  if (!household) {
    redirect(profileRequiredUrl(fromPath, ALL_MISSING))
  }
  const gate = isMinimumViableProfile(household)
  if (!gate.complete) {
    redirect(profileRequiredUrl(fromPath, gate.missing))
  }
}
