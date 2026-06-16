import { redirect } from 'next/navigation'
import {
  isMinimumViableProfile,
  type ProfileGateHousehold,
  type ProfileGateMissingField,
} from '@/lib/estate/profileGate'

const ALL_MISSING: ProfileGateMissingField[] = [
  'person1_name',
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

/** Redirect to profile when no household row exists (before MVP field checks). */
export function requireHouseholdRecord(
  household: { id: string } | null | undefined,
  fromPath: string,
): asserts household is { id: string } {
  if (!household) {
    redirect(profileRequiredUrl(fromPath, ALL_MISSING))
  }
}

/** Redirect to profile when household lacks minimum fields for estate planning pages. */
export function requireMinimumViableProfile<H extends ProfileGateHousehold>(
  household: H | null | undefined,
  fromPath: string,
): asserts household is H {
  if (!household) {
    redirect(profileRequiredUrl(fromPath, ALL_MISSING))
  }
  const gate = isMinimumViableProfile(household)
  if (!gate.complete) {
    redirect(profileRequiredUrl(fromPath, gate.missing))
  }
}
