// Single source of truth for what stage a user is in.
// Stage determines what the dashboard shows and what the next action is.

export type PlanStage = 1 | 2 | 3 | 4

export interface PlanStageResult {
  stage: PlanStage
  stageLabel: string
  nextActionLabel: string
  nextActionHref: string
  progressPct: number
  detailLabel: string
}

export interface DetermineStageInput {
  financialSectionsComplete: number
  wizardComplete: boolean
  userTier: number
  checklistPct: number
  checklistCompletedCount: number
  checklistTotalCount: number
  hasEstateData: boolean
  hasAdvisor: boolean
}

export function determinePlanStage(input: DetermineStageInput): PlanStageResult {
  const {
    financialSectionsComplete,
    wizardComplete,
    userTier,
    checklistPct,
    checklistCompletedCount,
    checklistTotalCount,
    hasAdvisor,
  } = input

  if (!wizardComplete || financialSectionsComplete < 4) {
    const financialPct = Math.round((financialSectionsComplete / 5) * 40)
    return {
      stage: 1,
      stageLabel: 'Financial Foundation',
      nextActionLabel: 'Complete your financial picture',
      nextActionHref:
        financialSectionsComplete === 0
          ? '/assets'
          : financialSectionsComplete < 2
            ? '/income'
            : '/expenses',
      progressPct: Math.max(5, financialPct),
      detailLabel: `${financialSectionsComplete} of 5 financial sections complete`,
    }
  }

  if (userTier < 3) {
    return {
      stage: 2,
      stageLabel: 'Retirement & Estate Setup',
      nextActionLabel:
        userTier === 2 ? 'Unlock Estate Planning' : 'Add retirement planning',
      nextActionHref:
        userTier === 2 ? '/unlock-estate' : '/billing?returnTo=/social-security',
      progressPct: 45,
      detailLabel:
        userTier === 2
          ? 'Complete retirement planning to unlock Estate tier'
          : 'Upgrade to add retirement and estate planning',
    }
  }

  if (checklistPct < 80) {
    const estatePct = 50 + Math.round((checklistPct / 100) * 40)
    return {
      stage: 3,
      stageLabel: 'Estate Planning',
      nextActionLabel: 'Complete your estate checklist',
      nextActionHref: '/my-estate-trust-strategy?tab=trusts',
      progressPct: Math.min(89, estatePct),
      detailLabel: `${checklistCompletedCount} of ${checklistTotalCount} estate items complete`,
    }
  }

  const advisorPct = hasAdvisor ? 100 : 95
  return {
    stage: 4,
    stageLabel: 'Plan Complete',
    nextActionLabel: hasAdvisor ? 'Review your plan annually' : 'Invite your advisor',
    nextActionHref: hasAdvisor ? '/dashboard' : '/my-advisor',
    progressPct: advisorPct,
    detailLabel: hasAdvisor
      ? 'Your estate plan is up to date'
      : 'Connect your advisor to complete your plan',
  }
}
