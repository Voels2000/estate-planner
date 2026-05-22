/**
 * RMD required beginning age per SECURE Act / SECURE 2.0 (birth-year cohorts).
 *
 * IRS cohorts (simplified by calendar birth year):
 * - Born 1960 or later → age 75
 * - Born 1951–1959 → age 73
 * - Born 1950 or earlier → age 72 (SECURE Act raised from 70½)
 */
export function getRmdStartAge(birthYear: number): number {
  if (birthYear >= 1960) return 75
  if (birthYear >= 1951) return 73
  return 72
}
