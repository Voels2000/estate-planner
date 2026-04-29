'use client'

/**
 * Advisor Strategy tab: overlays, SLAT/ILIT, advanced strategies, Monte Carlo,
 * and consumer plan status; reads ledger/config for display alongside advisor tools.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import AdvisoryMetricsDashboard from '@/components/advisor/AdvisoryMetricsDashboard'
import { ClientViewShellProps } from '../_client-view-shell'
import SLATILITPanel from '@/components/advisor/SLATILITPanel'
import AdvancedStrategyPanel from '@/components/advisor/AdvancedStrategyPanel'
import CompositeOverlay from '@/components/advisor/CompositeOverlay'
import StrategyHorizonTable from '@/components/shared/StrategyHorizonTable'
import MonteCarloPanel from '@/components/advisor/MonteCarloPanel'
import MonteCarloAssumptionsPanel from '@/components/advisor/MonteCarloAssumptionsPanel'
import { OBBBA_2026, type EstateScenario, type FilingStatus } from '@/lib/tax/estate-tax-constants'
import ConsumerPlanStatus from '@/components/advisor/ConsumerPlanStatus'
import { fetchStrategyLineItems, fetchStrategyConfigs } from '@/lib/estate/strategyLedger'
import type { StrategyLineItem, EstateComposition } from '@/lib/estate/types'
import type { MonteCarloAssumptions } from '@/lib/calculations/monteCarlo'

export default function StrategyTab({ household, scenario, advisorHorizons, advisorHorizonsProjected, strategySetSummary }: ClientViewShellProps) {
  const householdId = household?.id ?? null
  const hasHorizonTodayInputs =
    Number.isFinite(Number(advisorHorizons?.today.grossEstate ?? NaN)) &&
    Number.isFinite(Number(advisorHorizons?.today.federalExemption ?? NaN)) &&
    Number.isFinite(Number(advisorHorizons?.today.federalTaxEstimate ?? NaN)) &&
    Number.isFinite(Number(advisorHorizons?.today.stateTax ?? NaN))
  const grossEstate = hasHorizonTodayInputs ? Number(advisorHorizons?.today.grossEstate) : 0
  const filingStatus: FilingStatus = household?.filing_status === 'mfj' ? 'mfj' : 'single'
  const defaultExemption = filingStatus === 'mfj'
    ? OBBBA_2026.BASIC_EXCLUSION_MFJ
    : OBBBA_2026.BASIC_EXCLUSION_SINGLE
  // Unified engine source: today column from advisor horizons.
  const federalExemption = hasHorizonTodayInputs
    ? Number(advisorHorizons?.today.federalExemption)
    : defaultExemption
  const estimatedFederalTax = hasHorizonTodayInputs
    ? Number(advisorHorizons?.today.federalTaxEstimate)
    : 0
  const estimatedStateTax = hasHorizonTodayInputs
    ? Number(advisorHorizons?.today.stateTax)
    : 0
  const projectedGrossEstate = Number(advisorHorizonsProjected?.today.grossEstate ?? NaN)
  const projectedEstimatedFederalTax = Number(advisorHorizonsProjected?.today.federalTaxEstimate ?? NaN)
  const projectedEstimatedStateTax = Number(advisorHorizonsProjected?.today.stateTax ?? NaN)
  const rawLawScenario = scenario?.law_scenario as string | undefined
  const lawScenario: EstateScenario =
    rawLawScenario === 'no_exemption' ? 'no_exemption' : 'current_law'
  const person1BirthYear = household?.person1_birth_year ?? 1960
  const person2BirthYear = household?.person2_birth_year ?? undefined
  const annualRMD = Number(scenario?.annual_rmd ?? 0)
  const preIRABalance = Number(scenario?.pre_ira_balance ?? 0)
  const rothBalance = Number(scenario?.roth_balance ?? 0)
  const [slatIlitOpen, setSlatIlitOpen] = useState(true)
  const [advancedOpen, setAdvancedOpen] = useState(true)
  const [compositeOpen, setCompositeOpen] = useState(true)
  const [combinedMode, setCombinedMode] = useState<'actual' | 'projected'>('actual')
  const [monteCarloAssumptionsOpen, setMonteCarloAssumptionsOpen] = useState(false)
  const [monteCarloOpen, setMonteCarloOpen] = useState(true)
  const [activeAssumptions, setActiveAssumptions] = useState<MonteCarloAssumptions | null>(null)
  type StrategyLineItemSummary = Pick<StrategyLineItem, 'amount' | 'confidence_level' | 'effective_year' | 'is_active' | 'sign' | 'strategy_source' | 'source_role'>
  const [_advisorLineItems, setAdvisorLineItems] = useState<StrategyLineItemSummary[]>([])
  const [consumerLineItems, setConsumerLineItems] = useState<StrategyLineItemSummary[]>([])
  type StrategyConfigSummary = { strategy_source: StrategyLineItem['strategy_source'] }
  const [strategyConfigs, setStrategyConfigs] = useState<StrategyConfigSummary[]>([])
  const [consumerComposition, setConsumerComposition] = useState<EstateComposition | null>(null)
  const missingHorizonTelemetrySent = useRef(false)
  void _advisorLineItems

  // Gifting actuals from RPC
  const [giftingActuals, setGiftingActuals] = useState<{
    annualUsed: number
    annualCapacity: number
    lifetimeUsed: number
    lifetimeRemaining: number
    perRecipientLimit: number
    splitElected: boolean
    uniqueRecipients: number
  } | null>(null)

  useEffect(() => {
    if (!householdId) return
    fetch('/api/gifting-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) return
        setGiftingActuals({
          annualUsed: d.annual_used ?? 0,
          annualCapacity: d.annual_capacity ?? 0,
          lifetimeUsed: d.lifetime_used ?? 0,
          lifetimeRemaining: d.lifetime_remaining ?? 0,
          perRecipientLimit: d.per_recipient_limit ?? 19000,
          splitElected: d.split_elected ?? false,
          uniqueRecipients: d.unique_recipients ?? 2,
        })
      })
      .catch(() => null)
  }, [householdId])

  useEffect(() => {
    if (!householdId) return
    if (hasHorizonTodayInputs) return
    if (missingHorizonTelemetrySent.current) return
    missingHorizonTelemetrySent.current = true
    void fetch('/api/telemetry/horizon-input-missing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        surface: 'advisor_strategy_tab_today',
        householdId,
        lawScenario: rawLawScenario ?? 'current_law',
        missingFields: [
          Number.isFinite(Number(advisorHorizons?.today.grossEstate ?? NaN)) ? null : 'today.grossEstate',
          Number.isFinite(Number(advisorHorizons?.today.federalExemption ?? NaN)) ? null : 'today.federalExemption',
          Number.isFinite(Number(advisorHorizons?.today.federalTaxEstimate ?? NaN)) ? null : 'today.federalTaxEstimate',
          Number.isFinite(Number(advisorHorizons?.today.stateTax ?? NaN)) ? null : 'today.stateTax',
        ].filter(Boolean),
      }),
    }).catch(() => null)
  }, [advisorHorizons?.today.federalExemption, advisorHorizons?.today.federalTaxEstimate, advisorHorizons?.today.grossEstate, advisorHorizons?.today.stateTax, hasHorizonTodayInputs, householdId, rawLawScenario])

  const loadConsumerData = useCallback(async () => {
    if (!householdId) return
    Promise.all([
      fetchStrategyLineItems(householdId, 'advisor'),
      fetchStrategyLineItems(householdId, 'consumer'),
      fetchStrategyConfigs(householdId),
    ]).then(async ([adv, con, configs]) => {
      setAdvisorLineItems(adv)
      setConsumerLineItems(con)
      setStrategyConfigs((configs as StrategyConfigSummary[]) ?? [])
      try {
        const r = await fetch('/api/estate-composition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ householdId, sourceRole: 'consumer' }),
        })
        const d = await r.json()
        if (!d.error) setConsumerComposition(d)
      } catch {
        // non-fatal — ConsumerPlanStatus handles null gracefully
      }
    }).catch(() => null)
  }, [householdId])

  useEffect(() => {
    loadConsumerData()
  }, [loadConsumerData])

  // Auto-generate base case if missing (Session 18 fix)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const hasTriggeredRef = useRef(false)

  const profileIncomplete = !household?.person1_birth_year
  const needsGeneration = !grossEstate && !profileIncomplete

  useEffect(() => {
    if (!needsGeneration || hasTriggeredRef.current || generating) return
    hasTriggeredRef.current = true
    const timeoutId = window.setTimeout(() => {
      setGenerating(true)
      setGenerateError(null)
      fetch('/api/advisor/generate-base-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId }),
      })
        .then(async (res) => {
          const data = await res.json()
          if (!res.ok || data.error) {
            throw new Error(data.error ?? 'Failed to generate base case')
          }
          // Reload to refetch server-side household/scenario data
          window.location.reload()
        })
        .catch((err: Error) => {
          setGenerateError(err.message)
          setGenerating(false)
          hasTriggeredRef.current = false
        })
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [needsGeneration, generating, householdId])

  function handleRetry() {
    hasTriggeredRef.current = false
    setGenerateError(null)
    setGenerating(false)
    // Trigger effect again by forcing a re-render via state change
    setGenerating(true)
    setTimeout(() => setGenerating(false), 10)
  }

  // Friendly state when no base case exists
  if (!grossEstate) {
    if (profileIncomplete) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h3 className="text-sm font-semibold text-amber-900">
            Client profile is incomplete
          </h3>
          <p className="mt-2 text-sm text-amber-800">
            The client needs to complete their profile (birth year, retirement
            age, longevity age, and Social Security PIA) before a base case
            can be generated.
          </p>
        </div>
      )
    }
    if (generateError) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h3 className="text-sm font-semibold text-red-900">
            Unable to build estate plan
          </h3>
          <p className="mt-2 text-sm text-red-800">{generateError}</p>
          <button
            onClick={handleRetry}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      )
    }
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <h3 className="text-sm font-semibold text-blue-900">
            Building estate plan…
          </h3>
        </div>
        <p className="mt-2 text-sm text-blue-800">
          Running projections based on this client&apos;s profile, assets,
          income, and expenses. This usually takes about 10-20 seconds.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {!hasHorizonTodayInputs && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Today&apos;s horizon tax inputs are missing, so advisor strategy tax metrics are temporarily unavailable.
          Regenerate the base-case projection to restore consistent values across views.
        </div>
      )}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Advisory Metrics Dashboard</h2>
        <AdvisoryMetricsDashboard
          householdId={household.id}
          grossEstate={grossEstate}
          federalExemption={federalExemption}
          estimatedFederalTax={estimatedFederalTax}
          estimatedStateTax={estimatedStateTax}
          projectedGrossEstate={Number.isFinite(projectedGrossEstate) ? projectedGrossEstate : undefined}
          projectedEstimatedFederalTax={Number.isFinite(projectedEstimatedFederalTax) ? projectedEstimatedFederalTax : undefined}
          projectedEstimatedStateTax={Number.isFinite(projectedEstimatedStateTax) ? projectedEstimatedStateTax : undefined}
          hasSpouse={household?.has_spouse ?? false}
          section7520Rate={0.052}
        />
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Combined Strategy View</h2>
          <button
            onClick={() => setCompositeOpen((o) => !o)}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            {compositeOpen ? '▲ Collapse' : '▼ Expand'}
          </button>
        </div>
        {compositeOpen && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setCombinedMode('actual')}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${
                    combinedMode === 'actual'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Actual Estate
                </button>
                <button
                  type="button"
                  onClick={() => setCombinedMode('projected')}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${
                    combinedMode === 'projected'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Projected w/ Pending Advisor
                </button>
              </div>
              {strategySetSummary && (
                <div className="text-xs text-slate-600">
                  Actual: <span className="font-semibold">{strategySetSummary.actualCount}</span> · Pending advisor:{' '}
                  <span className="font-semibold">{strategySetSummary.pendingAdvisorCount}</span> · Projected:{' '}
                  <span className="font-semibold">{strategySetSummary.projectedCount}</span>
                </div>
              )}
            </div>

            {combinedMode === 'actual' && advisorHorizons && (
              <StrategyHorizonTable
                horizons={advisorHorizons}
                pendingItems={[]}
                federalExemption={federalExemption}
                mode="advisor"
              />
            )}
            {combinedMode === 'projected' && advisorHorizonsProjected && (
              <StrategyHorizonTable
                horizons={advisorHorizonsProjected}
                pendingItems={[]}
                federalExemption={federalExemption}
                mode="advisor"
              />
            )}

            <CompositeOverlay
              grossEstate={grossEstate}
              federalExemption={federalExemption}
              estimatedFederalTax={estimatedFederalTax}
              lawScenario={lawScenario}
              householdId={household.id}
              advisorHorizons={advisorHorizons}
              advisorHorizonsProjected={advisorHorizonsProjected}
              estateViewMode={combinedMode}
            />
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Irrevocable Trust Strategies</h2>
          <button
            onClick={() => setSlatIlitOpen((o) => !o)}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            {slatIlitOpen ? '▲ Collapse' : '▼ Expand'}
          </button>
        </div>
        {slatIlitOpen && (
          <SLATILITPanel
            householdId={household.id}
            grossEstate={grossEstate}
            federalExemption={federalExemption}
            person1BirthYear={person1BirthYear}
            person2BirthYear={person2BirthYear}
          />
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Advanced Strategies</h2>
          <button
            onClick={() => setAdvancedOpen((o) => !o)}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            {advancedOpen ? '▲ Collapse' : '▼ Expand'}
          </button>
        </div>
        {advancedOpen && (
          <AdvancedStrategyPanel
            householdId={household.id}
            grossEstate={grossEstate}
            federalExemption={federalExemption}
            estimatedFederalTax={estimatedFederalTax}
            estimatedStateTax={estimatedStateTax}
            person1BirthYear={person1BirthYear}
            person2BirthYear={person2BirthYear}
            filingStatus={filingStatus}
            giftingActuals={giftingActuals}
            advisorHorizons={advisorHorizons}
            annualRMD={annualRMD}
            preIRABalance={preIRABalance}
            rothBalance={rothBalance}
            onRecommend={async () => {
              await loadConsumerData()
            }}
          />
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Client&apos;s Confirmed Plan</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
            Read-only — client owns this
          </span>
        </div>
        <ConsumerPlanStatus
          consumerComposition={consumerComposition}
          consumerLineItems={consumerLineItems}
          strategyConfigs={strategyConfigs}
        />
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Monte Carlo — Assumption Overrides
            </h2>
            {activeAssumptions && (
              <p className="text-xs text-indigo-600 mt-0.5">
                Active scenario: custom assumptions applied
              </p>
            )}
          </div>
          <button
            onClick={() => setMonteCarloAssumptionsOpen((o) => !o)}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            {monteCarloAssumptionsOpen ? '▲ Collapse' : '▼ Expand'}
          </button>
        </div>
        {monteCarloAssumptionsOpen && (
          <MonteCarloAssumptionsPanel
            householdId={household.id}
            grossEstate={grossEstate}
            onAssumptionsChange={setActiveAssumptions}
          />
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Monte Carlo — Probabilistic Estate Tax Range
          </h2>
          <button
            onClick={() => setMonteCarloOpen((o) => !o)}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            {monteCarloOpen ? '▲ Collapse' : '▼ Expand'}
          </button>
        </div>
        {monteCarloOpen && (
          <MonteCarloPanel
            householdId={household.id}
            scenarioId={scenario?.id ?? undefined}
            grossEstate={grossEstate}
            federalExemption={federalExemption}
            estimatedStateTax={estimatedStateTax}
            person1BirthYear={person1BirthYear}
            lawScenario={lawScenario}
            supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}
            assumptions={activeAssumptions ?? undefined}
          />
        )}
      </section>

    </div>
  )
}
