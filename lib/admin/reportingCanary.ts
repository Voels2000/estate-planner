/**
 * Prod / E2E canary accounts — excluded from admin signup and revenue headline counts.
 *
 * Structure over memory: any profile whose email matches the canary pattern is
 * excluded automatically (no hardcoded email list). All prod smoke seeds use
 * *canary*@mywealthmaps.com addresses.
 */
export function isReportingExcludedCanaryEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false
  const lower = email.trim().toLowerCase()
  return lower.endsWith('@mywealthmaps.com') && lower.includes('canary')
}

export function filterReportingProfiles<T extends { email?: string | null }>(
  profiles: T[],
): T[] {
  return profiles.filter((p) => !isReportingExcludedCanaryEmail(p.email))
}
