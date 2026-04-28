'use client'

// ─────────────────────────────────────────
// Menu: Dashboard
// Route: /dashboard
// ─────────────────────────────────────────

import { useState } from 'react'
import { AssetAllocationSummary, type AssetAllocationContext } from '@/components/AssetAllocationSummary'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import type { CompletionScore } from '@/lib/get-completion-score'
import type { EstateHealthScore } from '@/lib/estate-health-score'
import { FeedbackButton } from './_components/feedback-button'
import type { EstateComposition } from '@/lib/estate/types'
import { firstName, fmt } from '@/app/(dashboard)/_components/dashboard/formatters'
import { FinancialSummarySection } from '@/app/(dashboard)/_components/dashboard/FinancialSummarySection'
import { RetirementSummarySection } from '@/app/(dashboard)/_components/dashboard/RetirementSummarySection'
import { EstateSummarySection } from '@/app/(dashboard)/_components/dashboard/EstateSummarySection'
import { DashboardIntroSection } from '@/app/(dashboard)/_components/dashboard/DashboardIntroSection'
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
    allocationContext, retirementSnapshot, estateHealthScore, conflictReport,
    setupSteps, completedSteps, progressPct,
    userId, householdId, hasBaseCase, scenarioId,
    completionScore, consumerTier, isAdvisor,
    rmdStatus,
    mortgageBalance,
    otherLiabilities,
    composition,
    initialRecommendations,
  } = props

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
      />

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

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — Retirement Summary                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <RetirementSummarySection
        storageKey={SECTION_KEYS.retirement}
        retirementSnapshot={retirementSnapshot}
        currentYearNet={currentYearNet}
        annualSSFromPIA={annualSSFromPIA}
        totalIncome={totalIncome}
        totalExpenses={totalExpenses}
        rmdStatus={rmdStatus}
      />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3 — Estate Summary                                        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
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

      <FeedbackButton userId={userId} />
      <div className="mt-8"><DisclaimerBanner /></div>
    </div>
  )
}
