export type ProfileGateMissingField = 'state_primary' | 'filing_status' | 'date_of_birth_1'

export type ProfileGateHousehold = {
  state_primary?: string | null
  filing_status?: string | null
  /** Primary person birth year (profile “Birth Year” field). */
  person1_birth_year?: number | null
  date_of_birth_1?: string | null
}

export interface ProfileGateResult {
  complete: boolean
  missing: ProfileGateMissingField[]
}

function hasPrimaryDateOfBirth(household: ProfileGateHousehold): boolean {
  if (household.person1_birth_year != null && household.person1_birth_year > 0) {
    return true
  }
  const dob = household.date_of_birth_1?.trim()
  return Boolean(dob)
}

export function isMinimumViableProfile(household: ProfileGateHousehold): ProfileGateResult {
  const missing: ProfileGateMissingField[] = []
  if (!household.state_primary?.trim()) missing.push('state_primary')
  if (!household.filing_status?.trim()) missing.push('filing_status')
  if (!hasPrimaryDateOfBirth(household)) missing.push('date_of_birth_1')
  return {
    complete: missing.length === 0,
    missing,
  }
}
