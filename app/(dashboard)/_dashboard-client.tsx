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
import { ESTATE_READINESS_LABEL, type EstateHealthScore } from '@/lib/estate-health-score'
import { FeedbackButton } from './_components/feedback-button'
import { LifeEventBanner, type LifeEvent, type LoggedLifeEvent } from './_components/LifeEventBanner'
import type { RelevanceHousehold } from '@/lib/events/catalog'
import type { EstateComposition } from '@/lib/estate/types'
import { isMFJFilingStatus } from '@/lib/calculations/stateEstateTax'
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
import { EstateReadinessCard } from '@/components/dashboard/EstateReadinessCard'
import { PriorityAlertCard } from '@/components/dashboard/PriorityAlertCard'
import {
  getAlertCTA,
  getAlertFact,
  getGreeting,
} from '@/lib/dashboard/scoreDisplayHelpers'
import { QuickAddAssetModal } from '@/components/dashboard/QuickAddAssetModal'
import { PersonaInsightCard } from '@/components/dashboard/PersonaInsightCard'
import { TermsBackfillBanner } from '@/components/dashboard/TermsBackfillBanner'
import { AdvisorConnectedBanner } from '@/components/dashboard/AdvisorConnectedBanner'
import type { PlanStageResult, DashboardState } from '@/lib/dashboard/determinePlanStage'
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
  priorScore?: number | null
  openAlerts?: Array<{
    id: string
    title: string | null
    message: string | null
    severity: string
    created_at: string
    action_href?: string | null
  }>
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
  dashboardState: DashboardState
  foundationScore: number
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
// State 2 — financial hero (net worth focus, estate not yet unlocked)
// ---------------------------------------------------------------------------

function State2NetWorthHero({
  netWorth,
  netWorthBySource,
  totalLiabilities,
  totalIncome,
  totalExpenses,
  savingsRate,
  foundationScore,
}: {
  netWorth: number
  netWorthBySource: Props['netWorthBySource']
  totalLiabilities: number
  totalIncome: number
  totalExpenses: number
  savingsRate: number
  foundationScore: number
}) {
  const rows = [
    { label: 'Financial assets', value: netWorthBySource.financial, color: '#185FA5' },
    { label: 'Real estate (FMV)', value: netWorthBySource.realEstateEquity, color: '#1D9E75' },
    { label: 'Business interests', value: netWorthBySource.business, color: '#888780' },
    { label: 'Liabilities', value: -totalLiabilities, color: '#F09595' },
  ].filter((r) => r.value !== 0)

  const maxVal = Math.max(
    netWorthBySource.financial,
    netWorthBySource.realEstateEquity,
    netWorthBySource.business,
    totalLiabilities,
    1,
  )

  return (
    <div className="rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white p-5">
      <p className="mb-1 text-3xl font-medium text-[color:var(--mwm-navy)]">{fmtExact(netWorth)}</p>
      <p className="mb-4 text-xs text-[color:var(--mwm-text-secondary)]">
        Net worth · assets minus liabilities
      </p>

      {rows.length > 0 && (
        <div className="mb-4 space-y-2">
          {rows.map((row) => {
            const barPct = Math.round((Math.abs(row.value) / maxVal) * 100)
            return (
              <div key={row.label} className="flex items-center gap-3 text-xs">
                <span className="w-28 shrink-0 text-[color:var(--mwm-text-secondary)]">{row.label}</span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--mwm-bg-muted)]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${barPct}%`, background: row.color }}
                  />
                </div>
                <span
                  className={`min-w-[50px] text-right font-medium ${row.value < 0 ? 'text-red-700' : 'text-[color:var(--mwm-navy)]'}`}
                >
                  {row.value < 0 ? `−${fmt(Math.abs(row.value))}` : fmt(row.value)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Annual income', value: fmt(totalIncome) },
          { label: 'Annual expenses', value: fmt(totalExpenses) },
          {
            label: 'Savings rate',
            value: `${savingsRate}%`,
            green: savingsRate >= 20,
          },
          {
            label: ESTATE_READINESS_LABEL,
            value: `${foundationScore}/100`,
            amber: true,
          },
        ].map((tile) => (
          <div key={tile.label} className="rounded-[var(--mwm-radius)] bg-[var(--mwm-bg-muted)] p-2.5">
            <p className="mb-1 text-[10px] text-[color:var(--mwm-text-secondary)]">{tile.label}</p>
            <p
              className={`text-sm font-medium ${
                tile.green ? 'text-emerald-700' : tile.amber ? 'text-amber-700' : 'text-[color:var(--mwm-navy)]'
              }`}
            >
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      {foundationScore > 0 && (
        <p className="mt-3 text-xs text-[color:var(--mwm-text-secondary)]">
          Complete your estate profile to see your full score.{' '}
          <Link href="/health-check" className="font-medium text-emerald-700 underline underline-offset-2">
            Go to health check →
          </Link>
        </p>
      )}
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
    retirementSnapshot, retirementAccountsTotal = 0, estateHealthScore, priorScore = null,
    openAlerts = [], conflictReport,
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
    dashboardState,
    foundationScore,
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
  const [otherAlertsExpanded, setOtherAlertsExpanded] = useState(false)
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
  const openAlertsCount = openAlerts.length

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

      {dashboardState === 2 && (
        <div className="space-y-4">
          <DashboardIntroSection
            greeting={greeting}
            firstName={fn}
            completionScore={completionScore}
            estateHealthScore={estateHealthScore}
            statePrimary={statePrimary}
            showReadinessPill={false}
            estateTaxExposure={null}
          />

          <State2NetWorthHero
            netWorth={netWorth}
            netWorthBySource={netWorthBySource}
            totalLiabilities={totalLiabilities}
            totalIncome={totalIncome}
            totalExpenses={totalExpenses}
            savingsRate={savingsRate}
            foundationScore={foundationScore}
          />

          <div className="flex flex-col gap-3 rounded-[var(--mwm-radius)] border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium text-amber-800">
                Complete your estate picture to see tax exposure and estate readiness
              </p>
              <p className="mt-0.5 text-[10px] text-amber-700">
                Add documents, beneficiaries, and incapacity planning to unlock your full estate dashboard
              </p>
            </div>
            <Link
              href="/my-estate-strategy"
              className="shrink-0 rounded-full bg-amber-800 px-3 py-1.5 text-center text-xs font-medium text-white hover:bg-amber-900"
            >
              Continue setup →
            </Link>
          </div>

          {!isAdvisor && (
            <div>
              <PlanProgressBar
                planStage={planStage}
                showAllTools={showAllTools}
                onShowAllTools={() => setShowAllTools((prev) => !prev)}
                onQuickAddAsset={() => setQuickAddOpen(true)}
                useQuickAddForNextAction={showQuickAddAsset}
              />
            </div>
          )}

          {!isAdvisor && (
            <div>
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

          <LifeEventBanner
            pendingEvents={pendingLifeEvents}
            loggedEvents={loggedLifeEvents}
            relevanceHousehold={lifeEventRelevance}
            hasAdvisorConnection={hasAdvisorConnection}
          />

          {sectionVisible(2) && (
            <AssessmentHistoryWidget initialResults={props.initialAssessmentResults} />
          )}

          {!isAdvisor && personaInsight && <PersonaInsightCard {...personaInsight} />}

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
            defaultOpen={true}
          />

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
        </div>
      )}

      {dashboardState !== 2 && (
        <>
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
            stateExemption={stateExemption}
            isMFJ={isMFJFilingStatus(composition?.filing_status)}
            userTier={tier}
          />
        </div>
      )}

      {estateHealthScore && (
        <div className="mt-4 space-y-4">
          {(() => {
            const g = getGreeting(estateHealthScore.score, fn)
            return (
              <div className="mb-2">
                <h2 className="text-xl font-medium text-[color:var(--mwm-navy)]">{g.headline}</h2>
                <p className="mt-0.5 text-sm text-[color:var(--mwm-text-secondary)]">{g.sub}</p>
              </div>
            )
          })()}

          <EstateReadinessCard
            score={estateHealthScore.score}
            priorScore={priorScore}
            components={estateHealthScore.components}
          />

          {openAlerts.length > 0 && (() => {
            const topAlert = openAlerts[0]
            const grossEstate = estateCallout?.grossEstate ?? totalAssets
            const fact = getAlertFact(
              topAlert.title ?? topAlert.message ?? '',
              grossEstate,
            )
            const cta = getAlertCTA(topAlert.severity, estateHealthScore.score)
            return (
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[color:var(--mwm-text-secondary)]">
                  {estateHealthScore.score >= 80 ? 'Staying current' : 'Focus here first'}
                </p>
                <PriorityAlertCard
                  alert={topAlert}
                  fact={fact}
                  cta={cta}
                  score={estateHealthScore.score}
                />
              </div>
            )
          })()}

          {openAlerts.length > 1 && (
            <div>
              <button
                type="button"
                className="flex items-center gap-1 py-2 text-sm text-[color:var(--mwm-text-secondary)]"
                onClick={() => setOtherAlertsExpanded((prev) => !prev)}
              >
                + {openAlerts.length - 1} other{' '}
                {openAlerts.length - 1 === 1 ? 'item' : 'items'}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  className={otherAlertsExpanded ? 'rotate-180' : ''}
                >
                  <path
                    d="M3 4.5L6 7.5L9 4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              {otherAlertsExpanded && (
                <div className="space-y-2 pl-1">
                  {openAlerts.slice(1).map((alert) => (
                    <div
                      key={alert.id}
                      className="rounded border border-[color:var(--mwm-border)] bg-white px-3 py-2"
                    >
                      <p className="text-sm font-medium text-[color:var(--mwm-navy)]">
                        {alert.title ?? alert.message}
                      </p>
                      {alert.message && alert.title && (
                        <p className="mt-0.5 text-xs text-[color:var(--mwm-text-secondary)]">
                          {alert.message}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {sectionVisible(3) && (executionChecklist.length > 0 || estateCallout) && (
        <div className="mt-4 space-y-4">
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
            composition={composition}
          />
        </div>
      )}
        </>
      )}

      <FeedbackButton userId={userId} />
      <div className="mt-8"><DisclaimerBanner /></div>
    </div>
    </>
  )
}
