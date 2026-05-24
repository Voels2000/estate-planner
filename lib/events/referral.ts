/**
 * Advisor referral mechanic for event pages.
 *
 * Usage: /event/selling-a-business?ref=ADVISOR_CODE
 *
 * When a visitor arrives with ?ref=, we store the referral in sessionStorage
 * so it survives through signup. On account creation, the referral can be
 * attributed to the advisor.
 */

export function buildAdvisorReferralUrl(
  eventSlug: string,
  advisorCode: string,
  baseUrl = 'https://mywealthmaps.com',
): string {
  return `${baseUrl}/event/${eventSlug}?ref=${encodeURIComponent(advisorCode)}`
}

export function buildAllEventReferralUrls(
  advisorCode: string,
  baseUrl = 'https://mywealthmaps.com',
): Record<string, string> {
  const slugs = [
    'selling-a-business',
    'death-of-spouse',
    'serious-diagnosis',
    'receiving-inheritance',
    'divorce',
    'approaching-retirement',
    'large-rsu-vest',
    'new-child-grandchild',
    'getting-married',
    'remarriage-blended-family',
    'aging-parent-needs-care',
    'loss-of-parent',
    'starting-a-business',
    'selling-a-home',
    'multi-state-real-estate',
    'child-reaching-adulthood',
    'disability-early-retirement',
    'estate-tax-law-change',
    'first-time-high-net-worth',
    'major-job-change',
    'five-year-plan-review',
    'rmd-start-age',
    'medicare-eligibility',
    'social-security-timing',
  ]
  return Object.fromEntries(
    slugs.map(slug => [slug, buildAdvisorReferralUrl(slug, advisorCode, baseUrl)]),
  )
}

export function buildAttorneyReferralUrl(
  eventSlug: string,
  attorneyCode: string,
  baseUrl = 'https://mywealthmaps.com',
): string {
  return `${baseUrl}/event/${eventSlug}?aref=${encodeURIComponent(attorneyCode)}`
}

export function buildAllAttorneyEventReferralUrls(
  attorneyCode: string,
  baseUrl = 'https://mywealthmaps.com',
): Record<string, string> {
  const slugs = [
    'selling-a-business',
    'death-of-spouse',
    'serious-diagnosis',
    'receiving-inheritance',
    'divorce',
    'approaching-retirement',
    'large-rsu-vest',
    'new-child-grandchild',
    'getting-married',
    'remarriage-blended-family',
    'aging-parent-needs-care',
    'loss-of-parent',
    'starting-a-business',
    'selling-a-home',
    'multi-state-real-estate',
    'child-reaching-adulthood',
    'disability-early-retirement',
    'estate-tax-law-change',
    'first-time-high-net-worth',
    'major-job-change',
    'five-year-plan-review',
    'rmd-start-age',
    'medicare-eligibility',
    'social-security-timing',
  ]
  return Object.fromEntries(
    slugs.map(slug => [slug, buildAttorneyReferralUrl(slug, attorneyCode, baseUrl)]),
  )
}
