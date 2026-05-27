'use client'

import { useMemo } from 'react'
import type { AdvisoryMetric } from '@/lib/advisoryMetrics'
import type { AdvisoryMetricsInput } from '@/lib/advisoryMetrics'
import type { AdvisorStrategyLineItemSummary } from '@/lib/estate/strategyLedger'
import type { StrategyQuestionNotification } from '@/components/advisor/ClientStrategyQuestionsCard'
import { resolveAdvisoryMetrics } from '@/lib/advisor/resolveAdvisoryMetrics'
import { StrategyAlertBanners } from '@/components/advisor/strategy/StrategyAlertBanners'
import { StrategyStep } from '@/components/advisor/strategy/StrategyStep'
import { SituationMetricsGrid } from '@/components/advisor/strategy/SituationMetricsGrid'
import { OpportunitiesPanel } from '@/components/advisor/strategy/OpportunitiesPanel'
import { RecommendationsPanel } from '@/components/advisor/strategy/RecommendationsPanel'
import { MetricExplanationsAccordion } from '@/components/advisor/strategy/MetricExplanationsAccordion'

interface StrategyTabContentProps {
  householdId: string
  metricsInput: AdvisoryMetricsInput
  cachedCoreMetrics?: AdvisoryMetric[]
  hasRunStrategyModules?: boolean
  section7520Rate?: number
  exemptionUtilization: number | null
  unusedExemptionAmount: number
  grossEstate: number
  estimatedFederalTax: number
  estimatedStateTax: number
  projectedGrossEstate?: number
  projectedEstimatedFederalTax?: number
  projectedEstimatedStateTax?: number
  strategyLineItems: AdvisorStrategyLineItemSummary[]
  strategyQuestions?: StrategyQuestionNotification[]
  onRunStrategyModules: () => void
  onAddRecommendation: () => void
}

export function StrategyTabContent({
  householdId,
  metricsInput,
  cachedCoreMetrics,
  hasRunStrategyModules = false,
  section7520Rate = 0.052,
  exemptionUtilization,
  unusedExemptionAmount,
  grossEstate,
  estimatedFederalTax,
  estimatedStateTax,
  projectedGrossEstate,
  projectedEstimatedFederalTax,
  projectedEstimatedStateTax,
  strategyLineItems,
  strategyQuestions,
  onRunStrategyModules,
  onAddRecommendation,
}: StrategyTabContentProps) {
  const metrics = useMemo(
    () =>
      resolveAdvisoryMetrics(metricsInput, {
        cachedCoreMetrics,
        hasRunStrategyModules,
      }),
    [cachedCoreMetrics, hasRunStrategyModules, metricsInput],
  )

  return (
    <div className="space-y-8 pb-12">
      <StrategyAlertBanners
        metrics={metrics}
        exemptionUtilization={exemptionUtilization}
        unusedExemptionAmount={unusedExemptionAmount}
        section7520Rate={section7520Rate}
      />

      <StrategyStep step={1} title="Situation" subtitle="Current exposure and planning position">
        <SituationMetricsGrid
          householdId={householdId}
          metricsInput={metricsInput}
          cachedCoreMetrics={cachedCoreMetrics}
          hasRunStrategyModules={hasRunStrategyModules}
          section7520Rate={section7520Rate}
        />
      </StrategyStep>

      <StrategyStep
        step={2}
        title="Opportunities"
        subtitle="Strategies available to model for this client"
      >
        <OpportunitiesPanel
          metrics={metrics}
          hasRunModules={hasRunStrategyModules}
          onRunStrategyModules={onRunStrategyModules}
        />
      </StrategyStep>

      <StrategyStep
        step={3}
        title="Recommendations"
        subtitle="Strategies sent to client and their response"
      >
        <RecommendationsPanel
          strategyLineItems={strategyLineItems}
          strategyQuestions={strategyQuestions}
          onAddRecommendation={onAddRecommendation}
        />
      </StrategyStep>

      <MetricExplanationsAccordion
        metricsInput={metricsInput}
        cachedCoreMetrics={cachedCoreMetrics}
        hasRunStrategyModules={hasRunStrategyModules}
        grossEstate={grossEstate}
        estimatedFederalTax={estimatedFederalTax}
        estimatedStateTax={estimatedStateTax}
        projectedGrossEstate={projectedGrossEstate}
        projectedEstimatedFederalTax={projectedEstimatedFederalTax}
        projectedEstimatedStateTax={projectedEstimatedStateTax}
      />
    </div>
  )
}
