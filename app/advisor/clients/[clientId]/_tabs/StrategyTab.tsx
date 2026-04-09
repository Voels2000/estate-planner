'use client'

import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import CharitableImpactCalculator from '@/components/advisor/CharitableImpactCalculator'
import { ClientViewShellProps } from '../_client-view-shell'
import StrategyOverlay from '@/components/advisor/StrategyOverlay'
import SLATILITPanel from '@/components/advisor/SLATILITPanel'

type StrategyLawScenario = 'current_law' | 'sunset' | 'no_exemption'

export default function StrategyTab({ household, scenario }: ClientViewShellProps) {
  const grossEstate = Number(scenario?.gross_estate ?? 0)
  const federalExemption = Number(scenario?.federal_exemption ?? 13_610_000)
  const lawScenario = (scenario?.law_scenario as StrategyLawScenario | undefined) ?? 'current_law'
  const person1BirthYear = household?.person1_birth_year ?? 1960
  const person2BirthYear = household?.person2_birth_year ?? undefined

  return (
    <div className="space-y-10">
      <DisclaimerBanner />

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Strategy Modeling</h2>
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
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Irrevocable Trust Strategies</h2>
        <SLATILITPanel
          householdId={household.id}
          grossEstate={grossEstate}
          federalExemption={federalExemption}
          person1BirthYear={person1BirthYear}
          person2BirthYear={person2BirthYear}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Charitable Planning</h2>
        <CharitableImpactCalculator householdId={household.id} isAdvisor />
      </section>
    </div>
  )
}
