'use client'

import { useState, useEffect, useRef } from 'react'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import AdvisoryMetricsDashboard from '@/components/advisor/AdvisoryMetricsDashboard'
import { ClientViewShellProps } from '../_client-view-shell'
import StrategyOverlay from '@/components/advisor/StrategyOverlay'
import SLATILITPanel from '@/components/advisor/SLATILITPanel'
import AdvancedStrategyPanel from '@/components/advisor/AdvancedStrategyPanel'
import CompositeOverlay from '@/components/advisor/CompositeOverlay'
import MonteCarloPanel from '@/components/advisor/MonteCarloPanel'

type StrategyLawScenario = 'current_law' | 'sunset' | 'no_exemption'

export default function StrategyTab({ household, scenario }: ClientViewShellProps) {
  const grossEstate = Number(scenario?.gross_estate ?? 0)
  const federalExemption = Number(scenario?.federal_exemption ?? 13_610_000)
  const estimatedFederalTax = Number(scenario?.estimated_federal_tax ?? 0)
  const estimatedStateTax = Number(scenario?.estimated_state_tax ?? 0)
  const lawScenario = (scenario?.law_scenario as StrategyLawScenario | undefined) ?? 'current_law'
  const person1BirthYear = household?.person1_birth_year ?? 1960
  const person2BirthYear = household?.person2_birth_year ?? undefined
  const annualRMD = Number(scenario?.annual_rmd ?? 0)
  const preIRABalance = Number(scenario?.pre_ira_balance ?? 0)
  const [strategyOverlayOpen, setStrategyOverlayOpen] = useState(true)
  const [slatIlitOpen, setSlatIlitOpen] = useState(true)
  const [advancedOpen, setAdvancedOpen] = useState(true)
  const [compositeOpen, setCompositeOpen] = useState(true)
  const [monteCarloOpen, setMonteCarloOpen] = useState(true)

  // Auto-generate base case if missing (Session 18 fix)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const hasTriggeredRef = useRef(false)

  const profileIncomplete = !household?.person1_birth_year
  const needsGeneration = !grossEstate && !profileIncomplete

  useEffect(() => {
    if (!needsGeneration || hasTriggeredRef.current || generating) return
    hasTriggeredRef.current = true
    setGenerating(true)
    setGenerateError(null)
    fetch('/api/advisor/generate-base-case', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId: household.id }),
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
  }, [needsGeneration, generating, household?.id])

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
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Advisory Metrics Dashboard</h2>
        <AdvisoryMetricsDashboard
          householdId={household.id}
          grossEstate={grossEstate}
          federalExemption={federalExemption}
          estimatedFederalTax={estimatedFederalTax}
          estimatedStateTax={estimatedStateTax}
          hasSpouse={household?.has_spouse ?? false}
          section7520Rate={0.052}
        />
      </section>

      <section>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-gray-900">Strategy Modeling</h2>
          <button
            onClick={() => setStrategyOverlayOpen((o) => !o)}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            {strategyOverlayOpen ? '▲ Collapse' : '▼ Expand'}
          </button>
        </div>
        {strategyOverlayOpen && (
          <>
            <p className="text-sm text-gray-500 mb-6">
              Model gifting programs, revocable trusts, and credit shelter trusts against the base case.
            </p>
            <StrategyOverlay
              householdId={household.id}
              grossEstate={grossEstate}
              federalExemption={federalExemption}
              person1BirthYear={person1BirthYear}
              person2BirthYear={person2BirthYear}
              lawScenario={lawScenario}
              person1RetirementAge={household?.person1_retirement_age ?? 65}
              growthRateAccumulation={household?.growth_rate_accumulation ?? 7}
              growthRateRetirement={household?.growth_rate_retirement ?? 5}
            />
          </>
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
            annualRMD={annualRMD}
            preIRABalance={preIRABalance}
          />
        )}
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
          <CompositeOverlay
            grossEstate={grossEstate}
            federalExemption={federalExemption}
            estimatedFederalTax={estimatedFederalTax}
            lawScenario={lawScenario}
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
          />
        )}
      </section>

      <DisclaimerBanner />
    </div>
  )
}
