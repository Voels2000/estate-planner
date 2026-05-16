/** Educational framing for planning-topic lists (not personalized advice). */

export type PlanningPrevalence = 'high' | 'moderate' | 'medium' | 'low'

export const PLANNING_PREVALENCE_GROUP_LABELS: Record<PlanningPrevalence, string> = {
  high: 'Common in many estate plans',
  moderate: 'Often discussed in planning',
  medium: 'Often discussed in planning',
  low: 'Depends on your situation',
}

export const PLANNING_TOPICS_SECTION_INTRO =
  'Topics below often come up in general estate planning conversations based on your profile inputs. Group labels describe how commonly many families and attorneys review them—not whether any item applies to you. This is educational information only; consult a qualified attorney before acting.'

export const PLANNING_TOPIC_BORDER: Record<string, string> = {
  high: 'border-l-slate-400',
  moderate: 'border-l-slate-300',
  medium: 'border-l-slate-300',
  low: 'border-l-slate-200',
}

export const PLANNING_TOPIC_BRANCH_LABELS: Record<string, string> = {
  will: 'Last Will & Testament',
  dpoa: 'Durable Power of Attorney',
  healthcare_directive: 'Advance Healthcare Directive',
  revocable_living_trust: 'Revocable Living Trust',
  pour_over_will: 'Pour-Over Will',
  bypass_trust: 'Bypass Trust (Credit Shelter)',
  ilit: 'Irrevocable Life Insurance Trust (ILIT)',
  gifting_strategy: 'Annual Gifting Strategy',
}

const EDUCATIONAL_REASON_BY_BRANCH: Record<string, string> = {
  will:
    'A last will is a foundational document in many estate plans. Your profile does not show one on file.',
  dpoa:
    'Many families address financial authority during incapacity with a durable power of attorney. None is recorded in your profile.',
  healthcare_directive:
    'Healthcare directives are commonly part of incapacity planning. None is recorded in your profile.',
  revocable_living_trust:
    'Larger estates often discuss revocable living trusts with counsel for probate avoidance and ongoing control.',
  pour_over_will:
    'Pour-over wills are frequently paired with living trusts when a trust is part of the plan.',
  ilit:
    'When life insurance may be included in the taxable estate, many families discuss irrevocable life insurance trusts (ILITs) with counsel.',
  gifting_strategy:
    'Annual gifting and lifetime exemption planning are common topics when estate tax exposure or prior gifts are present.',
}

/** Map trust-panel priority tiers to estate-summary prevalence keys. */
export const TRUST_PREVALENCE_LABELS = {
  high: PLANNING_PREVALENCE_GROUP_LABELS.high,
  medium: PLANNING_PREVALENCE_GROUP_LABELS.moderate,
  low: PLANNING_PREVALENCE_GROUP_LABELS.low,
} as const

export const TRUST_PREVALENCE_CARD_CLASS = {
  high: 'bg-slate-50 border-slate-200 text-slate-800',
  medium: 'bg-slate-50 border-slate-200 text-slate-700',
  low: 'bg-slate-50 border-slate-100 text-slate-600',
} as const

export const EDUCATIONAL_TOPICS_EMPTY_MESSAGE =
  'No topics to display at this time based on your profile inputs.'

export type EducationalTopicCard = {
  key?: string
  title: string
  detail: string
  priority: string | number
}

const GROUP_ORDER: PlanningPrevalence[] = ['high', 'moderate', 'low']

export function normalizePlanningPrevalence(priority: string | number): PlanningPrevalence {
  if (priority === 1 || priority === '1' || priority === 'high') return 'high'
  if (
    priority === 2 ||
    priority === '2' ||
    priority === 'moderate' ||
    priority === 'medium'
  ) {
    return 'moderate'
  }
  return 'low'
}

export function prevalenceLabelFor(priority: string | number): string {
  return PLANNING_PREVALENCE_GROUP_LABELS[normalizePlanningPrevalence(priority)]
}

export function prevalenceBorderFor(priority: string | number): string {
  return PLANNING_TOPIC_BORDER[normalizePlanningPrevalence(priority)] ?? 'border-l-slate-200'
}

export function prevalenceBadgeClass(): string {
  return 'bg-slate-100 text-slate-700'
}

/** Light-touch copy edits so RPC text reads as educational, not directive. */
export function softenEducationalCopy(text: string): string {
  return text
    .replace(/\brecommended\b/gi, 'commonly discussed')
    .replace(/\brecommend\b/gi, 'discuss')
    .replace(/\byou should\b/gi, 'many families')
    .replace(/\byou may want to\b/gi, 'it may be worth')
    .replace(/\byou need to\b/gi, 'counsel often addresses')
    .replace(/\byou are missing\b/gi, 'your profile does not show')
    .replace(/\byou have\b/gi, 'your profile reflects')
    .replace(/\bgap analysis\b/gi, 'planning topics')
    .replace(/\bplanning gap\b/gi, 'planning topic')
    .replace(/\bplanning gaps\b/gi, 'planning topics')
    .replace(/\bHigh Priority\b/g, 'Common in many estate plans')
    .replace(/\bModerate Priority\b/g, 'Often discussed in planning')
}

export function educationalPlanningTopicReason(branch: string, reason: string): string {
  if (branch === 'bypass_trust') {
    return softenEducationalCopy(
      reason
        .replace(/Bypass trust recommended/gi, 'Credit shelter (bypass) trusts are commonly discussed')
        .replace(/ recommended to /gi, ' often discussed alongside ')
        .replace(/A bypass trust /gi, 'Many attorneys discuss bypass trusts ')
        .replace(/Without a Credit Shelter Trust/gi, 'When credit shelter trusts are not used'),
    )
  }
  const mapped = EDUCATIONAL_REASON_BY_BRANCH[branch]
  return mapped ?? softenEducationalCopy(reason)
}

export function groupEducationalTopicsByPrevalence<T extends { priority: string | number }>(
  topics: T[],
): Array<{ level: PlanningPrevalence; items: T[] }> {
  return GROUP_ORDER.map((level) => ({
    level,
    items: topics.filter((t) => normalizePlanningPrevalence(t.priority) === level),
  })).filter((g) => g.items.length > 0)
}
