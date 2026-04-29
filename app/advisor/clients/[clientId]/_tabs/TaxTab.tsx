'use client'

/**
 * Advisor Tax tab: federal/state estate waterfall, NY cliff helper, and state tax panel.
 */

import { useEffect, useRef, useState } from 'react'
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

function estimateFederalTaxStress(grossEstate: number, federalExemption: number) {
  const taxable = Math.max(0, grossEstate - federalExemption)
  return Math.round(taxable * OBBBA_2026.TOP_RATE)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export default function TaxTab({
  household,
  estateTax,
  advisorHorizons,
  scenario,
  stateExemptions,
  estateComposition,
  stateEstateTaxRules,
  projectionRowsDomicile,
}: ClientViewShellProps) {
  const [lawScenario, setLawScenario] = useState<EstateScenario>('current_law')
  const filingStatus: FilingStatus = household?.filing_status === 'mfj' ? 'mfj' : 'single'

  // Canonical basis: today row from shared horizons.
  const grossEstate = isFiniteNumber(advisorHorizons?.today.grossEstate)
    ? Number(advisorHorizons?.today.grossEstate)
    : 0

  const hasHorizonFederalInputs =
    isFiniteNumber(advisorHorizons?.today.grossEstate) &&
    isFiniteNumber(advisorHorizons?.today.federalTaxEstimate)
  const missingHorizonTelemetrySent = useRef(false)

  const federalExemption = getFederalExemption(lawScenario, filingStatus)
  const federalTax =
    lawScenario === 'current_law'
      ? (hasHorizonFederalInputs ? Number(advisorHorizons?.today.federalTaxEstimate) : 0)
      : estimateFederalTaxStress(grossEstate, federalExemption)

  const stateCode = parseStateTaxCode((household?.state_primary ?? 'WA').toUpperCase())
  const currentYear = new Date().getFullYear()
  const projectionYears = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4, currentYear + 5]

  useEffect(() => {
    if (lawScenario !== 'current_law') return
    if (hasHorizonFederalInputs) return
    if (missingHorizonTelemetrySent.current) return

    missingHorizonTelemetrySent.current = true
    void fetch('/api/telemetry/horizon-input-missing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        surface: 'advisor_tax_tab_current_law',
        householdId: household?.id ?? null,
        lawScenario,
        missingFields: [
          !isFiniteNumber(advisorHorizons?.today.grossEstate) ? 'today.grossEstate' : null,
          !isFiniteNumber(advisorHorizons?.today.federalTaxEstimate) ? 'today.federalTaxEstimate' : null,
        ].filter(Boolean),
      }),
    }).catch(() => null)
  }, [advisorHorizons?.today.federalTaxEstimate, advisorHorizons?.today.grossEstate, hasHorizonFederalInputs, household?.id, lawScenario])

  return (
    <div className="space-y-8">
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
        {lawScenario === 'current_law' && !hasHorizonFederalInputs && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Federal current-law estimate is unavailable because required horizon inputs are missing.
            Regenerate the base-case projection to restore horizon-driven tax values.
          </div>
        )}
        <FederalStateWaterfall
          grossEstate={grossEstate}
          federalTax={federalTax}
          federalExemption={federalExemption}
          stateCode={stateCode}
          profileStateAbbrev={household?.state_primary}
          year={currentYear}
          dbExemptions={stateExemptions}
          scenarioLabel={LAW_SCENARIO_OPTIONS.find((o) => o.value === lawScenario)?.label}
          stateAbbrev={household?.state_primary}
          stateEstateTaxRules={stateEstateTaxRules}
          isMFJ={filingStatus === 'mfj'}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">State Tax Detail</h2>
        <StateTaxPanel
          grossEstate={grossEstate}
          stateCode={stateCode}
          profileStateAbbrev={household?.state_primary}
          projectionYears={projectionYears}
          federalExemption={federalExemption}
          dbExemptions={stateExemptions}
          stateAbbrev={household?.state_primary}
          stateEstateTaxRules={stateEstateTaxRules}
          isMFJ={filingStatus === 'mfj'}
          projectedGrossEstateByYear={projectionRowsDomicile ?? []}
        />
      </section>

      {household?.state_primary === 'NY' && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">NY Cliff Analysis</h2>
          <NYCliffValidator
            year={currentYear}
            dbExemptions={stateExemptions}
            stateEstateTaxRules={stateEstateTaxRules}
          />
        </section>
      )}
    </div>
  )
}
