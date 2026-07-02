import { getEventContent } from '@/lib/events/content'

/** Human labels for all 24 life-event referral slugs. */
export const ATTORNEY_EVENT_REFERRAL_LABELS: Record<string, string> = {
  'selling-a-business': 'Selling a business',
  'death-of-spouse': 'Death of a spouse',
  'serious-diagnosis': 'Serious diagnosis',
  'receiving-inheritance': 'Receiving an inheritance',
  divorce: 'Divorce',
  'approaching-retirement': 'Approaching retirement',
  'large-rsu-vest': 'Large RSU vest / liquidity event',
  'new-child-grandchild': 'New child or grandchild',
  'getting-married': 'Getting married',
  'remarriage-blended-family': 'Remarriage / blended family',
  'aging-parent-needs-care': 'Aging parent needs care',
  'loss-of-parent': 'Loss of a parent',
  'starting-a-business': 'Starting a business',
  'selling-a-home': 'Selling a home',
  'multi-state-real-estate': 'Multi-state real estate',
  'child-reaching-adulthood': 'Child reaching adulthood',
  'disability-early-retirement': 'Disability / early retirement',
  'estate-tax-law-change': 'Estate tax law change',
  'first-time-high-net-worth': 'First-time high-net-worth',
  'major-job-change': 'Major job change',
  'five-year-plan-review': 'Five-year plan review',
  'rmd-start-age': 'RMD start age (72–75, by birth year)',
  'medicare-eligibility': 'Medicare eligibility (65)',
  'social-security-timing': 'Social Security timing (62)',
}

export const ATTORNEY_EVENT_REFERRAL_GROUPS: { label: string; slugs: string[] }[] = [
  {
    label: 'Business & Wealth Events',
    slugs: [
      'selling-a-business',
      'starting-a-business',
      'large-rsu-vest',
      'first-time-high-net-worth',
      'major-job-change',
    ],
  },
  {
    label: 'Family & Life Transitions',
    slugs: [
      'death-of-spouse',
      'serious-diagnosis',
      'divorce',
      'getting-married',
      'remarriage-blended-family',
      'new-child-grandchild',
      'child-reaching-adulthood',
      'loss-of-parent',
      'aging-parent-needs-care',
      'disability-early-retirement',
    ],
  },
  {
    label: 'Real Estate & Inheritance',
    slugs: ['selling-a-home', 'multi-state-real-estate', 'receiving-inheritance'],
  },
  {
    label: 'Retirement & Tax Planning',
    slugs: [
      'approaching-retirement',
      'rmd-start-age',
      'medicare-eligibility',
      'social-security-timing',
      'estate-tax-law-change',
      'five-year-plan-review',
    ],
  },
]

/** Editorial default when attorney has no click history yet. */
export const ATTORNEY_NEWSLETTER_DEFAULT_BUNDLE_SLUGS = [
  'selling-a-business',
  'new-child-grandchild',
  'estate-tax-law-change',
] as const

export const ATTORNEY_MARKETING_FRAMING =
  'Your existing clients hit life events too — a business sale, a new grandchild, a move to a new state. Share the right link when it happens, and stay the attorney they call.'

export function attorneyEventReferralLabel(slug: string): string {
  return ATTORNEY_EVENT_REFERRAL_LABELS[slug] ?? slug
}

/** One-line tip from public event page copy (`subhead` first sentence). */
export function attorneyEventReferralUsageTip(slug: string): string | null {
  const content = getEventContent(slug)
  if (!content?.subhead?.trim()) return null
  const firstSentence = content.subhead.trim().split(/(?<=[.!?])\s+/)[0]?.trim()
  if (!firstSentence) return null
  if (firstSentence.length <= 140) return firstSentence
  return `${firstSentence.slice(0, 137).trim()}…`
}

export function buildAttorneyNewsletterEmailCopy(
  referralCode: string,
  eventReferralUrls: Record<string, string>,
): string {
  return `Subject: Estate planning resource for [life event] clients

I wanted to share a resource I recommend to clients navigating specific life events.

My Wealth Maps helps households with $2M–$30M understand estate tax exposure, identify plan gaps, and arrive at our meetings with focused questions.

Share the link that matches your client's situation:

${ATTORNEY_EVENT_REFERRAL_GROUPS.flatMap((g) => [
  `${g.label}:`,
  ...g.slugs.map(
    (s) => `• ${attorneyEventReferralLabel(s)}: ${eventReferralUrls[s] ?? ''}`,
  ),
  '',
]).join('\n')}
Visits through your links use your attorney referral code (${referralCode}).

— [Your name]`
}

export function buildAttorneyNewsletterPlainTextCopy(
  referralCode: string,
  eventReferralUrls: Record<string, string>,
): string {
  return `My Wealth Maps — estate planning for $2M–$30M households.

${ATTORNEY_EVENT_REFERRAL_GROUPS.flatMap((g) =>
  g.slugs.map((s) => `${attorneyEventReferralLabel(s)}: ${eventReferralUrls[s] ?? ''}`),
).join('\n')}
Attorney ref: ${referralCode}`
}
