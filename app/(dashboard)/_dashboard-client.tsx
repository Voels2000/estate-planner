'use client'

/**
 * Consumer dashboard client UI: intro, financial summary, retirement, estate summary,
 * and allocation context. Data is prepared on the server page.
 *
 * Route: `/dashboard`
 */

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  SetupProgressCard,
  SetupProgressCardSkeleton,
} from '@/components/dashboard/SetupProgressCard'
import type { SetupProgressCounts } from '@/lib/consumer/setupProgressCounts'
import { AssetAllocationSummary, type AssetAllocationContext } from '@/components/AssetAllocationSummary'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import type { CompletionScore } from '@/lib/get-completion-score'
import type { EstateHealthScore } from '@/lib/estate-health-score'
import { FeedbackButton } from './_components/feedback-button'
import { LifeEventBanner, type LifeEvent, type LoggedLifeEvent } from './_components/LifeEventBanner'
import type { RelevanceHousehold } from '@/lib/events/catalog'
import type { EstateComposition } from '@/lib/estate/types'
import { firstName, fmt } from '@/app/(dashboard)/_components/dashboard/formatters'
import { FinancialSummarySection } from '@/app/(dashboard)/_components/dashboard/FinancialSummarySection'
import { RetirementSummarySection } from '@/app/(dashboard)/_components/dashboard/RetirementSummarySection'
import { EstateSummarySection } from '@/app/(dashboard)/_components/dashboard/EstateSummarySection'
import { DashboardIntroSection } from '@/app/(dashboard)/_components/dashboard/DashboardIntroSection'
import {
  EstateCalloutCard,
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
import { estateDetailsHref } from '@/lib/dashboard/estateUpgradeHref'
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
  allocationContext: AssetAllocationContext
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
    allocationContext, retirementSnapshot, retirementAccountsTotal = 0, estateHealthScore, conflictReport,
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
  const conflictDetailsHref = estateDetailsHref(tier)

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
  const [conflictDismissed, setConflictDismissed] = useState(false)

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
        conflictReport={conflictReport}
        consumerTier={tier}
        estateTaxExposure={
          estateCallout
            ? {
                estimatedTaxState: estateCallout.estimatedTaxState,
                estimatedTaxFederal: estateCallout.estimatedTaxFederal,
              }
            : null
        }
      />

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
          <EstateCalloutCard
            {...estateCallout}
            userTier={tier}
            statePrimary={statePrimary}
          />
        </div>
      )}

      {sectionVisible(3) && executionChecklist.length > 0 && (
        <div className="mt-4">
          <EstateExecutionChecklist
            items={executionChecklist}
            userTier={tier}
            onToggle={toggleChecklistItem}
          />
        </div>
      )}

      {conflictReport &&
        (conflictReport.critical > 0 || conflictReport.warnings > 0) &&
        !conflictDismissed && (
          <div
            className={`mt-4 mb-2 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 ${
              conflictReport.critical > 0
                ? 'border-red-200 bg-red-50'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <span className="mt-0.5 shrink-0 text-base">
                {conflictReport.critical > 0 ? '🚨' : '⚠️'}
              </span>
              <div className="min-w-0">
                <p
                  className={`text-sm font-semibold ${
                    conflictReport.critical > 0 ? 'text-red-800' : 'text-amber-800'
                  }`}
                >
                  {conflictReport.critical > 0 && (
                    <span>
                      {conflictReport.critical} critical issue
                      {conflictReport.critical > 1 ? 's' : ''}
                      {conflictReport.warnings > 0 ? ' · ' : ''}
                    </span>
                  )}
                  {conflictReport.warnings > 0 && (
                    <span>
                      {conflictReport.warnings} warning
                      {conflictReport.warnings > 1 ? 's' : ''}
                    </span>
                  )}
                  {' '}found in your plan
                </p>
                {conflictReport.conflicts[0] && (
                  <p
                    className={`mt-0.5 text-xs truncate ${
                      conflictReport.critical > 0 ? 'text-red-600' : 'text-amber-600'
                    }`}
                  >
                    {conflictReport.conflicts[0].description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <a
                href={conflictDetailsHref}
                className={`text-xs font-medium underline-offset-2 hover:underline ${
                  conflictReport.critical > 0 ? 'text-red-700' : 'text-amber-700'
                }`}
              >
                See details ↓
              </a>
              <button
                type="button"
                onClick={() => setConflictDismissed(true)}
                className={`text-xs leading-none ${
                  conflictReport.critical > 0
                    ? 'text-red-400 hover:text-red-600'
                    : 'text-amber-400 hover:text-amber-600'
                }`}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

      {sectionVisible(2) && successionGap && (
        <div className="mt-4 mb-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">Business succession plan missing</p>
          <p className="mt-1 text-xs text-amber-800">
            You have business interests on file but no documented succession plan. Complete the quick
            intake to flag continuity risks on your estate summary.
          </p>
          <a
            href="/business-succession"
            className="mt-2 inline-block text-xs font-medium text-amber-900 underline-offset-2 hover:underline"
          >
            Document succession planning →
          </a>
        </div>
      )}

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
        allocationContext={allocationContext}
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
            householdId={householdId}
            initialRecommendations={initialRecommendations}
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
