'use client'

import { useMemo, useState } from 'react'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import FederalStateWaterfall from '@/components/advisor/FederalStateWaterfall'
import NYCliffValidator from '@/components/advisor/NYCliffValidator'
import StateTaxPanel from '@/components/advisor/StateTaxPanel'
import { parseStateTaxCode } from '@/lib/projection/stateRegistry'
import { ClientViewShellProps } from '../_client-view-shell'
import { OBBBA_2026, type EstateScenario, type FilingStatus } from '@/lib/tax/estate-tax-constants'

const LAW_SCENARIO_OPTIONS: { value: EstateScenario; label: string; description: string }[] = [
  {
    value: 'current_law',
    label: 'Current Law',
    description: 'Federal exemption under OBBBA: $15M single / $30M MFJ',
  },
  {
    value: 'no_exemption',
    label: 'No Exemption',
    description: 'Full estate taxed at marginal rates (planning stress test)',
  },
]

function getFederalExemption(lawScenario: EstateScenario, filingStatus: FilingStatus) {
  if (lawScenario === 'no_exemption') return 0
  return filingStatus === 'mfj'
    ? OBBBA_2026.BASIC_EXCLUSION_MFJ
    : OBBBA_2026.BASIC_EXCLUSION_SINGLE
}

function estimateFederalTax(grossEstate: number, federalExemption: number) {
  const taxable = Math.max(0, grossEstate - federalExemption)
  return Math.round(taxable * OBBBA_2026.TOP_RATE)
}

export default function TaxTab({ household, estateTax, stateExemptions }: ClientViewShellProps) {
  const [lawScenario, setLawScenario] = useState<EstateScenario>('current_law')
  const filingStatus: FilingStatus = household?.filing_status === 'mfj' ? 'mfj' : 'single'

  const grossEstate =
    (typeof estateTax?.gross_estate === 'number' ? estateTax.gross_estate : null) ??
    (typeof household?.gross_estate === 'number' ? household.gross_estate : null) ??
    0

  const federalExemption = getFederalExemption(lawScenario, filingStatus)
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          profileStateAbbrev={household?.state_primary}
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
          profileStateAbbrev={household?.state_primary}
          federalExemption={federalExemption}
          dbExemptions={stateExemptions}
        />
      </section>

      {household?.state_primary === 'NY' && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">NY Cliff Analysis</h2>
          <NYCliffValidator year={currentYear} dbExemptions={stateExemptions} />
        </section>
      )}
    </div>
  )
}
