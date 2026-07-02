import { buildAllAttorneyEventReferralUrls } from '@/lib/events/referral'

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

/**
 * Attorney-facing "Share when…" guidance — not consumer page copy.
 * Keys must match `buildAllAttorneyEventReferralUrls` slugs (24 events).
 */
export const ATTORNEY_EVENT_REFERRAL_USAGE_TIPS: Record<string, string> = {
  'selling-a-business':
    'Share when a client is mid-transaction or evaluating an offer — a sale can double taxable estate value overnight.',
  'starting-a-business':
    'Share when a client is forming a new entity — ownership structure affects the estate plan from day one.',
  'large-rsu-vest':
    'Share after a vest or exit — beneficiary designations are often stale by the time the cash lands.',
  'first-time-high-net-worth':
    'Share when a client crosses into planning-relevant assets for the first time — they may not know they need a plan yet.',
  'major-job-change':
    'Share after a client changes employers — old employer benefits and beneficiary forms often get left behind.',
  'death-of-spouse':
    'Share early in the process — surviving spouses often need to update nearly every document at once.',
  'serious-diagnosis':
    'Share when a client faces a new diagnosis — powers of attorney and healthcare directives matter most here.',
  divorce:
    'Share once a divorce is final — beneficiary designations do not update themselves, even after the decree does.',
  'getting-married':
    'Share soon after the wedding — titling, beneficiaries, and powers of attorney need to catch up to the new status.',
  'remarriage-blended-family':
    'Share early in a blended family — without updates, a prior plan can unintentionally disinherit a new spouse or stepchildren.',
  'new-child-grandchild':
    'Share after a birth — guardian designations and minor trust provisions need to be added, not assumed.',
  'child-reaching-adulthood':
    'Share as a child turns 18 — powers of attorney no longer automatically cover them, even for their own parents.',
  'loss-of-parent':
    'Share during estate settlement — this is often when a client first realizes their own plan is out of date.',
  'aging-parent-needs-care':
    'Share when a client becomes a caregiver — update their own POA and healthcare directive, not just their parent\'s.',
  'disability-early-retirement':
    'Share when a client\'s income or capacity changes unexpectedly — plans built for a different timeline need a second look.',
  'selling-a-home':
    'Share before or during a home sale — the primary residence exclusion is easy to miscalculate without a second read.',
  'multi-state-real-estate':
    'Share when a client buys property in another state — it can trigger probate in two places without the right structure.',
  'receiving-inheritance':
    'Share after a client receives an inheritance — new assets need to be titled and folded into the existing plan, not left standalone.',
  'approaching-retirement':
    'Share a few years out from retirement — this is the natural checkpoint to revisit the whole plan, not just income.',
  'rmd-start-age':
    'Share as a client nears RMD age — required withdrawals can interact with the estate plan in ways clients do not expect.',
  'medicare-eligibility':
    'Share around age 65 — Medicare decisions and estate planning timelines often land in the same year.',
  'social-security-timing':
    'Share when a client is deciding on claiming age — the choice affects survivor benefits, not just their own income.',
  'estate-tax-law-change':
    'Share whenever exemption thresholds shift — plans built around an old number can leave money on the table.',
  'five-year-plan-review':
    'Share on a rolling basis — even clients with no life change benefit from a scheduled second look.',
}

/** One-line tip for attorneys deciding when to share a life-event link. */
export function attorneyEventReferralUsageTip(slug: string): string | null {
  return ATTORNEY_EVENT_REFERRAL_USAGE_TIPS[slug] ?? null
}

/** Slugs that must have usage tips — kept in sync with `buildAllAttorneyEventReferralUrls`. */
export function attorneyReferralEventSlugs(): string[] {
  return Object.keys(buildAllAttorneyEventReferralUrls('__sync_check__'))
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
