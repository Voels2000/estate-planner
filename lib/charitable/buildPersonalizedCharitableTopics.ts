export type CharitableHouseholdContext = {
  statePrimary: string | null
  filingStatus: string | null
  person1BirthYear: number | null
  person2BirthYear: number | null
  hasSpouse: boolean
  person1Name: string | null
  preIraBalance?: number
}

export type CharitableTopic = {
  key: string
  title: string
  detail: string
  priority: number
}

const NO_INCOME_TAX_STATES = new Set([
  'AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY',
])

function personAge(birthYear: number | null): number | null {
  if (!birthYear || birthYear < 1900) return null
  return new Date().getFullYear() - birthYear
}

function filingLabel(filingStatus: string | null): string {
  switch (filingStatus) {
    case 'mfj':
    case 'married_filing_jointly':
      return 'married filing jointly'
    case 'mfs':
      return 'married filing separately'
    case 'hoh':
      return 'head of household'
    case 'qw':
      return 'qualifying widow(er)'
    default:
      return 'single'
  }
}

/** True when at least one household field can tailor topics (not only generic education). */
export function charitableTopicsUseProfileData(ctx: CharitableHouseholdContext): boolean {
  if (ctx.statePrimary?.trim()) return true
  if (ctx.filingStatus?.trim()) return true
  if (ctx.person1BirthYear != null && ctx.person1BirthYear > 0) return true
  if (ctx.hasSpouse && ctx.person2BirthYear != null && ctx.person2BirthYear > 0) return true
  if ((ctx.preIraBalance ?? 0) > 0) return true
  return false
}

export type PersonalizedCharitableTopicsResult = {
  topics: CharitableTopic[]
  /** When false, do not claim topics were driven by profile data in the UI. */
  usedProfileInputs: boolean
}

/** Household-aware planning topics when no donations are logged yet (Sprint 11). */
export function buildPersonalizedCharitableTopics(
  ctx: CharitableHouseholdContext,
): PersonalizedCharitableTopicsResult {
  const usedProfileInputs = charitableTopicsUseProfileData(ctx)
  const topics: CharitableTopic[] = []
  const state = (ctx.statePrimary ?? '').toUpperCase()
  const p1Age = personAge(ctx.person1BirthYear)
  const p2Age = ctx.hasSpouse ? personAge(ctx.person2BirthYear) : null
  const filing = filingLabel(ctx.filingStatus)
  const firstName = ctx.person1Name?.trim().split(/\s+/)[0] ?? 'you'

  topics.push({
    key: 'start-log',
    title: 'Log your first donation',
    detail: `Use “Log a Donation” to track cash, appreciated stock, DAF contributions, or QCDs. Your ${new Date().getFullYear()} summary and deduction limits update automatically.`,
    priority: 1,
  })

  if (state) {
    const stateNote = NO_INCOME_TAX_STATES.has(state)
      ? `${state} has no state income tax — federal itemized charitable deductions still apply if you itemize.`
      : `With domicile in ${state}, state income tax treatment of charitable deductions depends on your ${filing} return and whether you itemize.`
    topics.push({
      key: 'state',
      title: `Plan with ${state} in mind`,
      detail: stateNote,
      priority: 2,
    })
  } else {
    topics.push({
      key: 'state-missing',
      title: 'Add your state on Profile',
      detail: 'Charitable deduction limits and state tax impact depend on domicile. Complete Profile → state of residence for more accurate guidance.',
      priority: 2,
    })
  }

  const qcdEligible =
    (p1Age != null && p1Age >= 70) || (p2Age != null && p2Age >= 70)
  if (qcdEligible) {
    const iraNote =
      (ctx.preIraBalance ?? 0) > 0
        ? ' You have tax-deferred retirement balances on file — QCDs can satisfy RMDs without increasing AGI.'
        : ' QCDs must come from an IRA and can satisfy RMDs without increasing AGI.'
    topics.push({
      key: 'qcd',
      title: 'Consider a Qualified Charitable Distribution',
      detail: `${firstName}${ctx.hasSpouse && p2Age != null && p2Age >= 70 ? ' or your spouse' : ''} may be eligible for QCDs (age 70½+).${iraNote}`,
      priority: 3,
    })
  }

  topics.push({
    key: 'appreciated',
    title: 'Appreciated assets vs. cash',
    detail:
      'Donating long-term appreciated securities (or funding a DAF with them) can avoid capital gains while still supporting charities. Log FMV and cost basis when you record non-cash gifts.',
    priority: 4,
  })

  if (ctx.filingStatus === 'mfj' || ctx.filingStatus === 'married_filing_jointly') {
    topics.push({
      key: 'mfj-limits',
      title: 'Joint AGI limits apply',
      detail: `As ${filing}, cash gifts are generally limited to 60% of combined AGI and appreciated property to 30% — track both spouses’ donations in one household view.`,
      priority: 5,
    })
  }

  return {
    topics: topics.sort((a, b) => a.priority - b.priority),
    usedProfileInputs,
  }
}
