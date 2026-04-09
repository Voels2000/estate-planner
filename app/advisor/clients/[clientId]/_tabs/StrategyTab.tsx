'use client'

import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import CharitableImpactCalculator from '@/components/advisor/CharitableImpactCalculator'
import { ClientViewShellProps } from '../_client-view-shell'

export default function StrategyTab({ household }: ClientViewShellProps) {
  return (
    <div className="space-y-8">
      <DisclaimerBanner />

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Charitable Planning</h2>
        <CharitableImpactCalculator householdId={household.id} isAdvisor />
      </section>
    </div>
  )
}
