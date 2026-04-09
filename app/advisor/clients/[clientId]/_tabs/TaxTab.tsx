'use client'

import { useMemo, useState } from 'react'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import FederalStateWaterfall from '@/components/advisor/FederalStateWaterfall'
import NYCliffValidator from '@/components/advisor/NYCliffValidator'
import StateTaxPanel from '@/components/advisor/StateTaxPanel'
import { parseStateTaxCode } from '@/lib/projection/stateRegistry'
import { ClientViewShellProps } from '../_client-view-shell'

export type LawScenario = 'current_law' | 'sunset' | 'no_exemption'

const LAW_SCENARIO_OPTIONS: { value: LawScenario; label: string; description: string }[] = [
  {
    value: 'current_law',
    label: 'Current Law',
    description: 'Federal exemption at current indexed amount',
  },
  {
    value: 'sunset',
    label: 'Sunset (Post-2025)',
    description: 'Exemption reverts to lower levels after Dec 31, 2025',
  },
  {
    value: 'no_exemption',
    label: 'No Exemption',
    description: 'Full estate taxed at marginal rates (planning stress test)',
  },
]

function getFederalExemption(lawScenario: LawScenario) {
  if (lawScenario === 'sunset') return 7_000_000
  if (lawScenario === 'no_exemption') return 0
  return 13_610_000
}

function estimateFederalTax(grossEstate: number, federalExemption: number) {
  const taxable = Math.max(0, grossEstate - federalExemption)
  return Math.round(taxable * 0.4)
}

export default function TaxTab({ household, estateTax, stateExemptions }: ClientViewShellProps) {
  const [lawScenario, setLawScenario] = useState<LawScenario>('current_law')

  const grossEstate =
    (typeof estateTax?.gross_estate === 'number' ? estateTax.gross_estate : null) ??
    (typeof household?.gross_estate === 'number' ? household.gross_estate : null) ??
    0

  const federalExemption = getFederalExemption(lawScenario)
  const federalTax = useMemo(
    () => estimateFederalTax(grossEstate, federalExemption),
    [grossEstate, federalExemption]
  )

  const stateCode = parseStateTaxCode((household?.state_primary ?? 'WA').toUpperCase())
  const currentYear = new Date().getFullYear()

  return (
    <div className="space-y-8">
      <DisclaimerBanner />

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Law Scenario</h2>
        <p className="text-sm text-gray-500 mb-4">
          Select the federal tax law assumption for all calculations on this tab.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {LAW_SCENARIO_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setLawScenario(option.value)}
              className={`
                text-left rounded-lg border p-4 transition-colors
                ${lawScenario === option.value
                  ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                  : 'border-gray-200 bg-white hover:border-gray-300'
                }
              `}
            >
              <div className={`font-medium text-sm ${lawScenario === option.value ? 'text-blue-700' : 'text-gray-900'}`}>
                {option.label}
              </div>
              <div className="text-xs text-gray-500 mt-1">{option.description}</div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Federal & State Tax Waterfall</h2>
        <FederalStateWaterfall
          grossEstate={grossEstate}
          federalTax={federalTax}
          federalExemption={federalExemption}
          stateCode={stateCode}
          year={currentYear}
          dbExemptions={stateExemptions}
          scenarioLabel={LAW_SCENARIO_OPTIONS.find((o) => o.value === lawScenario)?.label}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">State Tax Detail</h2>
        <StateTaxPanel
          grossEstate={grossEstate}
          stateCode={stateCode}
          federalExemption={federalExemption}
          dbExemptions={stateExemptions}
        />
      </section>

      {/* Temp debug — remove after fix */}
      <pre className="text-xs bg-gray-100 p-2 rounded mb-4">
        state_primary: {JSON.stringify(household?.state_primary)}
      </pre>

      {household?.state_primary === 'NY' && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">NY Cliff Analysis</h2>
          <NYCliffValidator year={currentYear} dbExemptions={stateExemptions} />
        </section>
      )}
    </div>
  )
}
