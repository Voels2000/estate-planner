'use client'

import { useState } from 'react'
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

  if (!grossEstate) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg" />
          ))}
        </div>
        <div className="h-48 bg-gray-200 rounded-lg" />
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
