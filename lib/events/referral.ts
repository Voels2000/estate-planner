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
  baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://estate-planner-gules.vercel.app',
): string {
  return `${baseUrl}/event/${eventSlug}?ref=${encodeURIComponent(advisorCode)}`
}

export function buildAllEventReferralUrls(
  advisorCode: string,
  baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://estate-planner-gules.vercel.app',
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
  ]
  return Object.fromEntries(
    slugs.map(slug => [slug, buildAdvisorReferralUrl(slug, advisorCode, baseUrl)]),
  )
}
