'use client'

/**
 * Consumer dashboard client UI: intro, financial summary, retirement, estate summary,
 * and allocation context. Data is prepared on the server page.
 *
 * Route: `/dashboard`
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
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
import { AssessmentHistoryWidget } from '@/app/(dashboard)/_components/dashboard/AssessmentHistoryWidget'
import StrategyRecommendationPanel, {
  type AdvisorRecommendationItem,
} from '@/components/consumer/StrategyRecommendationPanel'
import MonteCarloScenarioBanner from '@/components/consumer/MonteCarloScenarioBanner'
import type { ConsumerMCScenario } from '@/lib/monte-carlo/consumerAssumptionScenarios'
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SetupStep = {
  key: string
  label: string
  href: string
  done: boolean
}

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
  setupSteps: SetupStep[]
  completedSteps: number
  progressPct: number
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
  successionGap?: boolean
  personaAlerts?: {
    businessThreshold: '5m' | '10m' | null
    businessOwnershipValue: number
    multiStateRealEstate: boolean
    distinctPropertyStates: string[]
  } | null
  showSetupPrompt?: boolean
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
    setupSteps, completedSteps, progressPct,
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
    successionGap = false,
    personaAlerts = null,
    showSetupPrompt = false,
  } = props

  const router = useRouter()
  void consumerTier
  void hasBaseCase
  void scenarioId
  void isAdvisor

  const fn = firstName(userName)
  const allDone = completedSteps === setupSteps.length
  const [greeting] = useState(() => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  })
  const [conflictDismissed, setConflictDismissed] = useState(false)

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <DashboardIntroSection
        greeting={greeting}
        firstName={fn}
        allDone={allDone}
        progressPct={progressPct}
        completedSteps={completedSteps}
        setupSteps={setupSteps}
        completionScore={completionScore}
        conflictReport={conflictReport}
      />

      <LifeEventBanner
        pendingEvents={pendingLifeEvents}
        loggedEvents={loggedLifeEvents}
        relevanceHousehold={lifeEventRelevance}
        hasAdvisorConnection={hasAdvisorConnection}
      />

      {showSetupPrompt && (
        <Card accent className="mt-4">
          <Card.Body>
            <h3 className="mb-1 font-[family-name:var(--font-display)] text-lg text-[color:var(--mwm-navy)]">
              Complete your financial picture
            </h3>
            <p className="mb-4 text-sm text-[color:var(--mwm-text-secondary)]">
              Add your assets and income to unlock your net worth, retirement trajectory, and
              planning gap detection. Most users see their first conflict alert within 5 minutes of
              entering data.
            </p>
            <div className="mb-5 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm text-[color:var(--mwm-text-secondary)]">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--mwm-navy)] text-xs text-white">
                  1
                </span>
                <span>
                  <strong className="text-[color:var(--mwm-navy)]">Financial</strong> — net worth,
                  income, basic projections
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[color:var(--mwm-text-secondary)]">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--mwm-border)] text-xs text-[color:var(--mwm-text-muted)]">
                  2
                </span>
                <span className="text-[color:var(--mwm-text-muted)]">
                  <strong>Retirement</strong> — Social Security, RMDs, Monte Carlo simulations
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[color:var(--mwm-text-secondary)]">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--mwm-border)] text-xs text-[color:var(--mwm-text-muted)]">
                  3
                </span>
                <span className="text-[color:var(--mwm-text-muted)]">
                  <strong>Estate</strong> — tax exposure, beneficiary conflicts, gifting strategies
                </span>
              </div>
            </div>
            <Button variant="gold" onClick={() => router.push('/onboarding/wizard')}>
              Continue setup →
            </Button>
          </Card.Body>
        </Card>
      )}

      {successionGap && (
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

      {personaAlerts?.businessThreshold && (
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

      {personaAlerts?.multiStateRealEstate && (
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
                href="#estate-conflicts"
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

      <AssessmentHistoryWidget />

      {householdId && advisorStrategyItems.length > 0 && (
        <div className="mt-6">
          <StrategyRecommendationPanel householdId={householdId} items={advisorStrategyItems} />
        </div>
      )}

      {(acceptedMCScenario || latestSharedMCScenario) && (
        <div className="mt-4">
          <MonteCarloScenarioBanner
            acceptedScenario={acceptedMCScenario}
            latestSharedScenario={latestSharedMCScenario}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — Financial Summary                                     */}
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

      {estateCallout && (
        <div className="mt-6">
          <EstateCalloutCard {...estateCallout} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — Retirement Summary                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3 — Estate Summary                                        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div id="estate-conflicts">
        <EstateSummarySection
          storageKey={SECTION_KEYS.estate}
          totalAssets={totalAssets}
          netWorth={netWorth}
          estateHealthScore={estateHealthScore}
          conflictReport={conflictReport}
          composition={composition}
          householdId={householdId}
          initialRecommendations={initialRecommendations}
        />
      </div>

      <FeedbackButton userId={userId} />
      <div className="mt-8"><DisclaimerBanner /></div>
    </div>
  )
}
