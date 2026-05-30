'use client'

/**
 * Consumer dashboard client UI: intro, financial summary, retirement, and estate summary.
 * Data is prepared on the server page.
 *
 * Route: `/dashboard`
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  SetupProgressCard,
  SetupProgressCardSkeleton,
} from '@/components/dashboard/SetupProgressCard'
import type { SetupProgressCounts } from '@/lib/consumer/setupProgressCounts'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import type { CompletionScore } from '@/lib/get-completion-score'
import type { EstateHealthScore } from '@/lib/estate-health-score'
import { FeedbackButton } from './_components/feedback-button'
import { LifeEventBanner, type LifeEvent, type LoggedLifeEvent } from './_components/LifeEventBanner'
import type { RelevanceHousehold } from '@/lib/events/catalog'
import type { EstateComposition } from '@/lib/estate/types'
import { firstName, fmt, fmtExact } from '@/app/(dashboard)/_components/dashboard/formatters'
import { FinancialSummarySection } from '@/app/(dashboard)/_components/dashboard/FinancialSummarySection'
import { RetirementSummarySection } from '@/app/(dashboard)/_components/dashboard/RetirementSummarySection'
import { EstateSummarySection } from '@/app/(dashboard)/_components/dashboard/EstateSummarySection'
import { DashboardIntroSection } from '@/app/(dashboard)/_components/dashboard/DashboardIntroSection'
import {
  EstateSummaryHeroAndMetrics,
  EstateTaxSnapshotPanel,
  type EstateCalloutCardProps,
} from '@/components/dashboard/EstateCalloutCard'
import { EstateExecutionChecklist } from '@/components/consumer/EstateExecutionChecklist'
import type { EstateExecutionItem } from '@/lib/dashboard/buildEstateExecutionChecklist'
import { AssessmentHistoryWidget } from '@/components/dashboard/AssessmentHistoryWidget'
import StrategyRecommendationPanel, {
  type AdvisorRecommendationItem,
} from '@/components/consumer/StrategyRecommendationPanel'
import MonteCarloScenarioBanner from '@/components/consumer/MonteCarloScenarioBanner'
import type { ConsumerMCScenario } from '@/lib/monte-carlo/consumerAssumptionScenarios'
import { PlanProgressBar } from '@/components/dashboard/PlanProgressBar'
import { QuickAddAssetModal } from '@/components/dashboard/QuickAddAssetModal'
import { PersonaInsightCard } from '@/components/dashboard/PersonaInsightCard'
import { TermsBackfillBanner } from '@/components/dashboard/TermsBackfillBanner'
import { AdvisorConnectedBanner } from '@/components/dashboard/AdvisorConnectedBanner'
import type { PlanStageResult } from '@/lib/dashboard/determinePlanStage'
import type { OnboardingPersona } from '@/lib/onboarding/personaConfig'
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RetirementSnapshot = {
  p1Name: string | null
  p1RetirementAge: number | null
  p1SSClaimingAge: number | null
  p1MonthlyBenefit: number | null
  p1BirthYear: number | null
  p2Name: string | null
  p2RetirementAge: number | null
  p2SSClaimingAge: number | null
  p2MonthlyBenefit: number | null
  hasSpouse: boolean
  yearsToRetirement: number | null
  combinedSSMonthly: number | null
  projectedAnnualIncome: number | null
  projectedAnnualExpenses: number | null
  projectedIncomeGap: number | null
}

type Props = {
  userName: string
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  netWorthBySource: {
    financial: number
    realEstateEquity: number
    business: number
    insurance: number
  }
  totalIncome: number
  totalExpenses: number
  savingsRate: number
  currentYearNet: number       // totalIncome (all sources incl SS) - totalExpenses
  annualSSFromPIA: number      // SS component for display breakdown
  retirementSnapshot: RetirementSnapshot | null
  retirementAccountsTotal?: number
  estateHealthScore?: EstateHealthScore | null
  conflictReport?: {
    conflicts: Array<{
      conflict_type: string
      severity: string
      description: string
      recommended_action: string
    }>
    critical: number
    warnings: number
  } | null
  userId: string
  householdId?: string | null
  hasBaseCase?: boolean
  scenarioId?: string | null
  completionScore?: CompletionScore | null
  consumerTier?: number
  isAdvisor?: boolean
  rmdStatus: {
    p1Name: string
    p2Name: string | null
    p1Required: number
    p1Planned: number
    p1StartYear: number | null
    p2Required: number
    p2Planned: number
    p2StartYear: number | null
    hasSpouse: boolean
  } | null
  mortgageBalance: number
  otherLiabilities: number
  composition?: EstateComposition | null
  initialRecommendations?: Array<{
    branch: string
    priority: 'high' | 'moderate' | 'low'
    reason: string
  }> | null
  advisorStrategyItems?: AdvisorRecommendationItem[]
  acceptedMCScenario?: ConsumerMCScenario | null
  latestSharedMCScenario?: ConsumerMCScenario | null
  estateCallout?: EstateCalloutCardProps | null
  pendingLifeEvents?: LifeEvent[]
  loggedLifeEvents?: LoggedLifeEvent[]
  lifeEventRelevance?: RelevanceHousehold
  hasAdvisorConnection?: boolean
  advisorConnectionSummary?: {
    id: string
    advisorName: string
    connectedAt: string
  } | null
  successionGap?: boolean
  personaAlerts?: {
    businessThreshold: '5m' | '10m' | null
    businessOwnershipValue: number
    multiStateRealEstate: boolean
    distinctPropertyStates: string[]
  } | null
  wizardComplete?: boolean
  initialSetupProgress?: SetupProgressCounts
  initialAssessmentResults?: Array<{
    id: string
    taken_at: string
    overall_score: number
    financial_pct: number
    retirement_pct: number
    estate_pct: number
  }>
  statePrimary?: string | null
  stateExemption?: number | null
  noPortability?: boolean
  executionChecklist?: EstateExecutionItem[]
  planStage: PlanStageResult
  termsAcceptedAt?: string | null
  assetTypes?: Array<{ value: string; label: string }>
  person1Name?: string
  person2Name?: string
  hasSpouse?: boolean
  personaInsight?: {
    persona: OnboardingPersona
    showCard: boolean
    totalAssets: number
    hasBusinessAsset: boolean
    hasRealEstateAsset: boolean
    distinctPropertyStates: number
    estateTaxEstimate: number | null
    retirementAge: number | null
    currentAge: number | null
    yearsToRetirement: number | null
  } | null
}

// ---------------------------------------------------------------------------
// localStorage keys for section open/close state
// ---------------------------------------------------------------------------

const SECTION_KEYS = {
  financial: 'dashboard_section_financial',
  retirement: 'dashboard_section_retirement',
  estate: 'dashboard_section_estate',
} as const

function parseBypassTrustSavings(
  recommendations: Props['initialRecommendations'],
  grossEstate: number | undefined,
  stateExemption: number | null,
  noPortability: boolean,
): number {
  const rec = recommendations?.find((r) => r.branch === 'bypass_trust')
  if (!rec) return 0

  // Primary: "reduce Washington estate tax by $645,463 or more"
  const byMatch = rec.reason.match(/by (\$[\d,]+)/i)
  if (byMatch) {
    return parseInt(byMatch[1].replace(/[$,]/g, ''), 10)
  }

  // Fallback: last dollar figure in the RPC reason string
  const dollarMatches = rec.reason.match(/\$[\d,]+/g)
  if (dollarMatches?.length) {
    const last = dollarMatches[dollarMatches.length - 1]
    return parseInt(last.replace(/[$,]/g, ''), 10)
  }

  if (noPortability && stateExemption && grossEstate && grossEstate > stateExemption) {
    return Math.round(Math.max(0, (grossEstate - stateExemption) * 0.10))
  }
  return 0
}

const WA_NO_PORTABILITY_STATES = new Set(['WA', 'MA', 'OR'])

const BENEFICIARY_CONFLICT_TYPES = new Set([
  'no_primary_beneficiary',
  'no_contingent_beneficiary',
  'allocation_not_100',
])

type ConsolidatedAlert = {
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  link: string
  linkLabel: string
}

function ConsolidatedAlertPanel({
  conflictReport,
  estateHealthScore,
  bypassTrustSavings,
  statePrimary,
  stateExemption,
  successionGap,
  estimatedTaxState,
}: {
  conflictReport: Props['conflictReport']
  estateHealthScore?: EstateHealthScore | null
  bypassTrustSavings: number
  statePrimary: string | null | undefined
  stateExemption: number | null
  successionGap: boolean
  estimatedTaxState: number
}) {
  const alerts: ConsolidatedAlert[] = []

  const beneficiaryConflicts = (conflictReport?.conflicts ?? []).filter(
    (c) =>
      BENEFICIARY_CONFLICT_TYPES.has(c.conflict_type) ||
      /beneficiar/i.test(c.description),
  )
  const beneficiariesComponent = estateHealthScore?.components.find((c) => c.key === 'beneficiaries')

  if (
    beneficiaryConflicts.length > 0 ||
    (beneficiariesComponent && beneficiariesComponent.score < beneficiariesComponent.maxScore)
  ) {
    const exemplar =
      beneficiaryConflicts.find((c) => c.severity === 'critical') ?? beneficiaryConflicts[0]
    const title =
      exemplar?.conflict_type === 'allocation_not_100'
        ? 'Beneficiary allocations need review'
        : exemplar?.conflict_type === 'no_contingent_beneficiary'
          ? 'Accounts missing contingent beneficiary on file'
          : 'Accounts have no primary beneficiary on file'

    alerts.push({
      severity:
        exemplar?.severity === 'critical' || (conflictReport?.critical ?? 0) > 0
          ? 'critical'
          : 'warning',
      title,
      description:
        exemplar?.description ??
        'One or more accounts have beneficiary designations that may need review. Accounts without complete beneficiary information typically pass through the estate — your attorney can advise on the implications for your plan.',
      link: '/titling',
      linkLabel: 'Review in Titling & Beneficiaries →',
    })
  }

  const documentsComponent = estateHealthScore?.components.find((c) => c.key === 'documents')
  const trustConflict = (conflictReport?.conflicts ?? []).find(
    (c) => c.conflict_type === 'large_estate_no_trust',
  )

  if (
    (documentsComponent && documentsComponent.score < documentsComponent.maxScore) ||
    trustConflict
  ) {
    alerts.push({
      severity:
        trustConflict?.severity === 'critical' ||
        (documentsComponent?.status === 'critical' && !trustConflict)
          ? 'critical'
          : 'warning',
      title: 'No will, trust, or estate documents recorded',
      description:
        trustConflict?.description ??
        'No will, trust, power of attorney, or healthcare directive has been entered in your profile. These are common foundational documents in estate plans — your attorney can confirm what is currently in place and what may be needed.',
      link: '/my-estate-trust-strategy?tab=trusts',
      linkLabel: 'Record documents in Trusts & Documents →',
    })
  }

  const incapacityComponent = estateHealthScore?.components.find((c) => c.key === 'incapacity')

  if (incapacityComponent && incapacityComponent.score < incapacityComponent.maxScore) {
    alerts.push({
      severity: incapacityComponent.status === 'critical' ? 'critical' : 'warning',
      title: 'No incapacity planning documents recorded',
      description:
        'No durable power of attorney or healthcare directive has been entered. Attorneys commonly address financial and medical decision-making authority as part of incapacity planning — review your current documents with counsel.',
      link: '/incapacity-planning',
      linkLabel: 'Record documents in Incapacity Planning →',
    })
  }

  if (successionGap) {
    alerts.push({
      severity: 'warning',
      title: 'Business interests on file — no succession plan recorded',
      description:
        'Your profile includes business interests but no succession plan has been entered. Many estate plans for business owners address continuity and ownership transfer — your advisor or attorney can review what documentation exists.',
      link: '/business-succession',
      linkLabel: 'Record succession information →',
    })
  }

  if (
    bypassTrustSavings > 0 &&
    statePrimary &&
    WA_NO_PORTABILITY_STATES.has(statePrimary.toUpperCase())
  ) {
    alerts.push({
      severity: 'info',
      title: `${statePrimary} does not allow portability of its state estate tax exemption`,
      description: `Based on your ${statePrimary} domicile and estate size, the estimated ${statePrimary} estate tax is ${fmtExact(estimatedTaxState)}. ${statePrimary}'s ${fmtExact(stateExemption ?? 3_000_000)} individual exemption is not portable between spouses — attorneys commonly discuss credit shelter trust structures in this situation. Review with your estate attorney.`,
      link: '/my-estate-strategy',
      linkLabel: 'View estate tax strategies →',
    })
  }

  if (alerts.length === 0) return null

  const severityOrder = { critical: 0, warning: 1, info: 2 } as const
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length
  const warningCount = alerts.filter((a) => a.severity === 'warning').length
  const infoCount = alerts.filter((a) => a.severity === 'info').length

  const dotColor = {
    critical: 'bg-red-500',
    warning: 'bg-amber-400',
    info: 'bg-blue-400',
  }

  const severityLabel = {
    critical: 'Critical',
    warning: 'Incomplete',
    info: 'For review',
  }

  const severityStyle = {
    critical: 'bg-red-50 text-red-800',
    warning: 'bg-amber-50 text-amber-800',
    info: 'bg-blue-50 text-blue-800',
  }

  return (
    <div className="overflow-hidden rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white">
      <div className="flex items-center justify-between border-b border-[color:var(--mwm-border)] bg-[var(--mwm-bg-muted)] px-4 py-3 gap-3 flex-wrap">
        <div>
          <p className="text-xs font-medium text-[color:var(--mwm-navy)]">
            Items for review with your advisor or attorney
          </p>
          <p className="mt-0.5 text-[10px] text-[color:var(--mwm-text-secondary)]">
            Based on information you&apos;ve entered · not financial, tax, or legal advice
          </p>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-800">
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
              {warningCount} incomplete
            </span>
          )}
          {infoCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-800">
              {infoCount} for review
            </span>
          )}
        </div>
      </div>

      {alerts.map((alert) => (
        <div
          key={`${alert.severity}-${alert.title}`}
          className="flex items-start gap-3 border-b border-[color:var(--mwm-border)] px-4 py-3 last:border-b-0"
        >
          <div className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${dotColor[alert.severity]}`} />
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs font-medium text-[color:var(--mwm-navy)]">{alert.title}</p>
            <p className="text-[11px] leading-relaxed text-[color:var(--mwm-text-secondary)]">
              {alert.description}
            </p>
            <Link
              href={alert.link}
              className="mt-1.5 inline-block text-[11px] text-emerald-700 underline underline-offset-2"
            >
              {alert.linkLabel}
            </Link>
          </div>
          <span
            className={`mt-0.5 flex-shrink-0 self-start rounded px-1.5 py-0.5 text-[9px] font-medium ${severityStyle[alert.severity]}`}
          >
            {severityLabel[alert.severity]}
          </span>
        </div>
      ))}

      <div className="border-t border-[color:var(--mwm-border)] bg-[var(--mwm-bg-muted)] px-4 py-2">
        <p className="text-[10px] leading-relaxed text-[color:var(--mwm-text-secondary)]">
          This summary reflects information you&apos;ve entered. It is for planning preparation purposes only —
          not financial, tax, or legal advice. Consult your financial advisor, CPA, or estate attorney before
          taking action.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DashboardClient(props: Props) {
  const {
    userName, totalAssets, totalLiabilities, netWorth, netWorthBySource,
    totalIncome, totalExpenses, savingsRate, currentYearNet, annualSSFromPIA,
    retirementSnapshot, retirementAccountsTotal = 0, estateHealthScore, conflictReport,
    userId, householdId, hasBaseCase, scenarioId,
    completionScore, consumerTier, isAdvisor,
    rmdStatus,
    mortgageBalance,
    otherLiabilities,
    composition,
    initialRecommendations,
    advisorStrategyItems = [],
    acceptedMCScenario,
    latestSharedMCScenario,
    estateCallout,
    pendingLifeEvents = [],
    loggedLifeEvents = [],
    lifeEventRelevance,
    hasAdvisorConnection = false,
    advisorConnectionSummary = null,
    successionGap = false,
    personaAlerts = null,
    wizardComplete = false,
    initialSetupProgress,
    initialAssessmentResults,
    statePrimary,
    stateExemption = null,
    noPortability = false,
    executionChecklist: initialExecutionChecklist = [],
    planStage,
    termsAcceptedAt = null,
    assetTypes = [],
    person1Name = 'Person 1',
    person2Name = 'Person 2',
    hasSpouse = false,
    personaInsight = null,
  } = props

  const searchParams = useSearchParams()
  const checkoutSuccess = searchParams.get('checkout') === 'success'
  const importSetup = searchParams.get('setup') === 'imported'
  const importSummary = searchParams.get('import_summary')
  const [checkoutBannerDismissed, setCheckoutBannerDismissed] = useState(false)
  const [importToastDismissed, setImportToastDismissed] = useState(false)

  const tier = consumerTier ?? 1
  const [executionChecklist, setExecutionChecklist] = useState(initialExecutionChecklist)

  const [showAllTools, setShowAllTools] = useState(planStage.stage >= 3)

  useEffect(() => {
    const stored = localStorage.getItem('mwm_show_all_tools')
    if (stored !== null) {
      setShowAllTools(stored === 'true')
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('mwm_show_all_tools', String(showAllTools))
  }, [showAllTools])

  function sectionVisible(minStage: 1 | 2 | 3 | 4): boolean {
    if (showAllTools) return true
    return planStage.stage >= minStage
  }

  const router = useRouter()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [setupProgress, setSetupProgress] = useState<SetupProgressCounts | null>(
    initialSetupProgress ?? null,
  )
  const [setupProgressLoading, setSetupProgressLoading] = useState(initialSetupProgress == null)

  useEffect(() => {
    if (isAdvisor || initialSetupProgress != null) {
      setSetupProgressLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/consumer/setup-progress')
        if (!res.ok) return
        const data = (await res.json()) as SetupProgressCounts
        if (!cancelled) setSetupProgress(data)
      } finally {
        if (!cancelled) setSetupProgressLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAdvisor, initialSetupProgress])
  void hasBaseCase
  void scenarioId
  void isAdvisor

  const fn = firstName(userName)
  const [greeting] = useState(() => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  })
  useEffect(() => {
    setExecutionChecklist(initialExecutionChecklist)
  }, [initialExecutionChecklist])

  const toggleChecklistItem = async (taskKey: string, completed: boolean) => {
    const res = await fetch('/api/consumer/estate-checklist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_key: taskKey, completed }),
    })
    if (!res.ok) return
    setExecutionChecklist((prev) =>
      prev.map((item) =>
        item.task_key === taskKey
          ? {
              ...item,
              consumerChecked: completed,
              status: completed ? 'complete' : item.status,
            }
          : item,
      ),
    )
  }

  const showQuickAddAsset =
    !isAdvisor &&
    planStage.stage === 1 &&
    (setupProgress?.assets ?? 0) === 0 &&
    assetTypes.length > 0

  const pendingRecsCount = advisorStrategyItems.filter(
    (i) => !i.consumer_accepted && !i.consumer_rejected,
  ).length
  const openAlertsCount =
    (conflictReport?.critical ?? 0) + (conflictReport?.warnings ?? 0)

  const bypassTrustSavings = parseBypassTrustSavings(
    initialRecommendations,
    estateCallout?.grossEstate,
    stateExemption,
    noPortability,
  )

  return (
    <>
      {!isAdvisor && (
        <QuickAddAssetModal
          open={quickAddOpen}
          onClose={() => setQuickAddOpen(false)}
          assetTypes={assetTypes}
          person1Name={person1Name}
          person2Name={person2Name}
          hasSpouse={hasSpouse}
        />
      )}
    <div className="mx-auto max-w-7xl px-4 py-12">
      {checkoutSuccess && !checkoutBannerDismissed && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950/40">
          <p className="text-sm font-medium text-green-700 dark:text-green-300">
            Your subscription is active. Welcome to My Wealth Maps!
          </p>
          <button
            type="button"
            onClick={() => {
              setCheckoutBannerDismissed(true)
              router.replace('/dashboard')
            }}
            className="ml-4 flex-shrink-0 text-xs text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {importSetup && !importToastDismissed && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-[color:var(--mwm-gold)] bg-[var(--mwm-gold-pale)] px-4 py-3">
          <p className="text-sm font-medium text-[color:var(--mwm-navy)]">
            Great start — {importSummary ? `${importSummary} imported.` : 'your spreadsheet is imported.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setImportToastDismissed(true)
              router.replace('/dashboard')
            }}
            className="ml-4 flex-shrink-0 text-xs text-[color:var(--mwm-navy)] hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {!isAdvisor && (
        <TermsBackfillBanner initialTermsAcceptedAt={termsAcceptedAt} />
      )}

      {!isAdvisor && advisorConnectionSummary && (
        <div className="mt-4">
          <AdvisorConnectedBanner
            connectionId={advisorConnectionSummary.id}
            advisorName={advisorConnectionSummary.advisorName}
            connectedAt={advisorConnectionSummary.connectedAt}
          />
        </div>
      )}

      <DashboardIntroSection
        greeting={greeting}
        firstName={fn}
        completionScore={completionScore}
        estateHealthScore={estateHealthScore}
        statePrimary={statePrimary}
        estateTaxExposure={
          estateCallout
            ? {
                estimatedTaxState: estateCallout.estimatedTaxState,
                estimatedTaxFederal: estateCallout.estimatedTaxFederal,
              }
            : null
        }
      />

      {(openAlertsCount > 0 || pendingRecsCount > 0) && (
        <div className="lg:hidden mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-sm font-medium text-amber-900">
            {openAlertsCount > 0 &&
              `${openAlertsCount} open alert${openAlertsCount > 1 ? 's' : ''}`}
            {openAlertsCount > 0 && pendingRecsCount > 0 && ' · '}
            {pendingRecsCount > 0 &&
              `${pendingRecsCount} advisor recommendation${pendingRecsCount > 1 ? 's' : ''} to review`}
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            Tap to review — full planning features are best on desktop.
          </p>
        </div>
      )}

      {!isAdvisor && (
        <div className="mt-4">
          <PlanProgressBar
            planStage={planStage}
            showAllTools={showAllTools}
            onShowAllTools={() => setShowAllTools((prev) => !prev)}
            onQuickAddAsset={() => setQuickAddOpen(true)}
            useQuickAddForNextAction={showQuickAddAsset}
          />
        </div>
      )}

      {sectionVisible(2) && estateCallout && (
        <div className="mt-4">
          <EstateSummaryHeroAndMetrics
            {...estateCallout}
            statePrimary={statePrimary}
            userTier={tier}
          />
        </div>
      )}

      {sectionVisible(3) && (executionChecklist.length > 0 || estateCallout || estateHealthScore) && (
        <div className="mt-4 space-y-4">
          <ConsolidatedAlertPanel
            conflictReport={conflictReport}
            estateHealthScore={estateHealthScore}
            bypassTrustSavings={bypassTrustSavings}
            statePrimary={statePrimary}
            stateExemption={stateExemption}
            successionGap={successionGap}
            estimatedTaxState={estateCallout?.estimatedTaxState ?? composition?.estimated_tax_state ?? 0}
          />

          {estateHealthScore && estateHealthScore.components.length > 0 && (
            <div className="rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--mwm-text-secondary)]">
                  Estate readiness · {estateHealthScore.score}/100
                </p>
                <Link
                  href="/titling"
                  className="text-[11px] text-emerald-700 underline underline-offset-2"
                >
                  Update health check →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {estateHealthScore.components.map((comp) => {
                  const pct = Math.round((comp.score / comp.maxScore) * 100)
                  const color = pct === 100 ? '#1D9E75' : pct >= 60 ? '#EF9F27' : '#E24B4A'
                  const textColor = pct === 100 ? '#0F6E56' : pct >= 60 ? '#854F0B' : '#A32D2D'
                  return (
                    <div key={comp.key} className="flex flex-col gap-1">
                      <p className="truncate text-[10px] text-[color:var(--mwm-text-secondary)]">
                        {comp.label}
                      </p>
                      <div className="h-1 overflow-hidden rounded-full bg-[var(--mwm-bg-muted)]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                      <p className="text-[10px] font-medium" style={{ color: textColor }}>
                        {comp.score}/{comp.maxScore}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {(executionChecklist.length > 0 || estateCallout) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {executionChecklist.length > 0 && (
                <EstateExecutionChecklist
                  items={executionChecklist}
                  userTier={tier}
                  onToggle={toggleChecklistItem}
                  deemphasizeFlagged
                />
              )}
              {estateCallout && (
                <EstateTaxSnapshotPanel
                  grossEstate={estateCallout.grossEstate}
                  totalLiabilities={totalLiabilities}
                  taxableEstate={composition?.taxable_estate}
                  federalExemption={composition?.exemption_available}
                  federalTax={estateCallout.estimatedTaxFederal}
                  estateTax={estateCallout.estimatedTaxState}
                  statePrimary={statePrimary}
                  stateExemption={stateExemption}
                  noPortability={noPortability}
                  consumerTier={tier}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* successionGap banner removed — covered by ConsolidatedAlertPanel */}

      {sectionVisible(2) && personaAlerts?.businessThreshold && (
        <div className="mt-4 mb-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm font-semibold text-blue-900">
            {personaAlerts.businessThreshold === '10m'
              ? 'Business interests at $10M+ on file'
              : 'Business interests at $5M+ on file'}
          </p>
          <p className="mt-1 text-xs text-blue-800">
            {personaAlerts.businessThreshold === '10m'
              ? 'At this scale, buy-sell agreements, succession timing, and estate tax coordination usually need a dedicated plan — not just a will update.'
              : 'Crossing $5M in business value is a common trigger for succession planning, key-person coverage, and coordinating entity value with your personal estate.'}
          </p>
          <a
            href="/business-succession"
            className="mt-2 inline-block text-xs font-medium text-blue-900 underline-offset-2 hover:underline"
          >
            Review business succession →
          </a>
        </div>
      )}

      {sectionVisible(2) && personaAlerts?.multiStateRealEstate && (
        <div className="mt-4 mb-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">Multi-state real estate on file</p>
          <p className="mt-1 text-xs text-amber-800">
            Properties in {personaAlerts.distinctPropertyStates.join(', ')} ({personaAlerts.distinctPropertyStates.length}{' '}
            states). Real estate titled in your personal name may require ancillary probate in each state — trust or LLC
            ownership is often used to avoid separate court proceedings.
          </p>
          <a
            href="/real-estate"
            className="mt-2 inline-block text-xs font-medium text-amber-900 underline-offset-2 hover:underline"
          >
            Review property titling →
          </a>
        </div>
      )}

      <LifeEventBanner
        pendingEvents={pendingLifeEvents}
        loggedEvents={loggedLifeEvents}
        relevanceHousehold={lifeEventRelevance}
        hasAdvisorConnection={hasAdvisorConnection}
      />

      {sectionVisible(2) && householdId && advisorStrategyItems.length > 0 && (
        <div className="mt-6">
          <StrategyRecommendationPanel householdId={householdId} items={advisorStrategyItems} />
        </div>
      )}

      {sectionVisible(3) && (acceptedMCScenario || latestSharedMCScenario) && (
        <div className="mt-4">
          <MonteCarloScenarioBanner
            acceptedScenario={acceptedMCScenario}
            latestSharedScenario={latestSharedMCScenario}
          />
        </div>
      )}

      {sectionVisible(2) && (
        <AssessmentHistoryWidget initialResults={props.initialAssessmentResults} />
      )}

      {!isAdvisor && personaInsight && (
        <PersonaInsightCard {...personaInsight} />
      )}

      {!isAdvisor && (planStage.stage === 1 || showAllTools) && (
        <div className="mt-4">
          {setupProgressLoading || !setupProgress ? (
            <SetupProgressCardSkeleton />
          ) : (
            <SetupProgressCard
              progress={setupProgress}
              wizardComplete={wizardComplete}
              onImport={() => router.push('/import')}
              onQuickAddAsset={showQuickAddAsset ? () => setQuickAddOpen(true) : undefined}
            />
          )}
        </div>
      )}

      {planStage.stage === 1 && !showAllTools && (
        <div className="mt-4 rounded-xl border border-[color:var(--mwm-border)] bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-[color:var(--mwm-navy)]">What comes next</p>
          <div className="space-y-2">
            {[
              {
                label: 'Retirement Planning',
                description: 'Social Security, RMDs, and lifetime projections',
                tier: 2,
              },
              {
                label: 'Estate Tax Snapshot',
                description: 'See your tax exposure and model strategies',
                tier: 3,
              },
              {
                label: 'Estate Execution Checklist',
                description: 'Will, POA, beneficiaries, trust funding',
                tier: 3,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between border-b border-neutral-50 py-2 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-700">{item.label}</p>
                  <p className="text-xs text-[color:var(--mwm-text-muted)]">{item.description}</p>
                </div>
                <span className="text-xs font-medium text-neutral-300">Tier {item.tier}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* Financial Summary                                                 */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <FinancialSummarySection
        storageKey={SECTION_KEYS.financial}
        totalAssets={totalAssets}
        totalLiabilities={totalLiabilities}
        netWorth={netWorth}
        netWorthBySource={netWorthBySource}
        mortgageBalance={mortgageBalance}
        otherLiabilities={otherLiabilities}
        totalIncome={totalIncome}
        totalExpenses={totalExpenses}
        savingsRate={savingsRate}
      />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* Retirement Summary                                                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {sectionVisible(2) && (
        <RetirementSummarySection
          storageKey={SECTION_KEYS.retirement}
          retirementSnapshot={retirementSnapshot}
          retirementAccountsTotal={retirementAccountsTotal}
          currentYearNet={currentYearNet}
          annualSSFromPIA={annualSSFromPIA}
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          rmdStatus={rmdStatus}
        />
      )}

      {sectionVisible(3) && (
        <div id={tier >= 3 ? 'estate-conflicts' : undefined}>
          <EstateSummarySection
            storageKey={SECTION_KEYS.estate}
            totalAssets={totalAssets}
            netWorth={netWorth}
            estateHealthScore={estateHealthScore}
            conflictReport={conflictReport}
            composition={composition}
            consumerTier={tier}
          />
        </div>
      )}

      <FeedbackButton userId={userId} />
      <div className="mt-8"><DisclaimerBanner /></div>
    </div>
    </>
  )
}
