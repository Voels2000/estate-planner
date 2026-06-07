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
import { formatCurrency } from '../_utils'
import { getPortabilityGapLabel, getStateDisplayName, isMFJFilingStatus } from '@/lib/calculations/stateEstateTax'
import { OBBBA_2026, type EstateScenario, type FilingStatus } from '@/lib/tax/estate-tax-constants'
import { computeFederalExportTax } from '@/lib/tax/federalExportTax'
import type { EstateTaxBracket } from '@/lib/calculations/estate-tax'

const LAW_SCENARIO_OPTIONS: { value: EstateScenario; label: string; description: string }[] = [
  {
    value: 'current_law',
    label: 'Current Law',
    description: 'Federal exemption under OBBBA: $15M single / $30M MFJ',
  },
  {
    value: 'no_exemption',
    label: 'Sunset / No Exemption Stress Test',
    description: 'Full estate taxed at marginal rates — models post-sunset or exemption elimination scenario',
  },
]

function getFederalExemption(lawScenario: EstateScenario, filingStatus: FilingStatus) {
  if (lawScenario === 'no_exemption') return 0
  return filingStatus === 'mfj'
    ? OBBBA_2026.BASIC_EXCLUSION_MFJ
    : OBBBA_2026.BASIC_EXCLUSION_SINGLE
}

function estimateFederalTaxStress(
  grossEstate: number,
  federalExemption: number,
  filingStatus: FilingStatus,
  hasSpouse: boolean,
  federalBrackets: EstateTaxBracket[],
) {
  return computeFederalExportTax({
    grossEstate,
    filingStatus,
    hasSpouse,
    brackets: federalBrackets,
    lawScenario: 'no_exemption',
    exemptionCapOverride: federalExemption,
  }).federalTax
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
  federalBrackets = [],
}: ClientViewShellProps) {
  // ENG-1 AUDIT NOTE:
  // Tax tab current-law numbers are horizon-driven (advisorHorizons.today).
  // This includes actualStrategies from strategyMappers.ts:
  // consumer rows + advisor rows where consumer_accepted = true.
  const [lawScenario, setLawScenario] = useState<EstateScenario>('current_law')
  const filingStatus: FilingStatus = isMFJFilingStatus(household?.filing_status) ? 'mfj' : 'single'
  const isMFJ = filingStatus === 'mfj'

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
      : estimateFederalTaxStress(
          grossEstate,
          federalExemption,
          filingStatus,
          household?.has_spouse ?? false,
          federalBrackets,
        )

  const statePrimary = (household?.state_primary ?? '').trim().toUpperCase()
  const stateCode = parseStateTaxCode(statePrimary || null)
  const stateDisplayName = getStateDisplayName(statePrimary || null)
  const stateHasNoPortability = getPortabilityGapLabel(statePrimary || null) != null
  const currentYear = new Date().getFullYear()
  const projectionYears = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4, currentYear + 5]

  const scenarioRecord = scenario as { outputs_s2_first?: unknown[] } | null | undefined
  const usesSurvivorProjectionTimeline =
    Array.isArray(scenarioRecord?.outputs_s2_first) && scenarioRecord.outputs_s2_first.length > 0

  const horizonTodayStateTax = isFiniteNumber(advisorHorizons?.today.stateTax)
    ? Number(advisorHorizons?.today.stateTax)
    : null
  const acceptedStrategyTotal = Number(advisorHorizons?.today.outsideCertainProbableTotal ?? 0) +
    Number(advisorHorizons?.today.outsideIllustrativeTotal ?? 0)
  const horizonTodayStateTaxWithCST = isFiniteNumber(advisorHorizons?.today.stateTaxWithCST)
    ? Number(advisorHorizons?.today.stateTaxWithCST)
    : null
  const atDeathHorizon = advisorHorizons?.atDeath
  const horizonAtDeathStateTax =
    atDeathHorizon && isFiniteNumber(atDeathHorizon.stateTax) ? Number(atDeathHorizon.stateTax) : null
  const horizonAtDeathGross =
    atDeathHorizon && isFiniteNumber(atDeathHorizon.grossEstate) ? Number(atDeathHorizon.grossEstate) : null

  const taxBasisNote = isMFJ && stateHasNoPortability
    ? `Today’s snapshot only (${formatCurrency(grossEstate)} gross estate). State tax uses one exemption at second death (${stateDisplayName} has no portability) unless a Credit Shelter Trust is in place — matches Strategy → Today.`
    : `Today’s snapshot only (${formatCurrency(grossEstate)} gross estate). Matches Strategy → Today column.`

  const projectionTimelineNote = usesSurvivorProjectionTimeline
    ? `The waterfall above is a single-year “today” view. This table follows the surviving spouse projection timeline (after first death), so later years and the at-death row can show a larger estate and higher ${stateDisplayName} tax than today. Compare the violet “At death” callout to Strategy → At Death.`
    : `The waterfall above is today’s snapshot only. This table projects gross estate forward by calendar year from the base-case scenario; later years may show higher ${stateDisplayName} tax as the estate grows.`

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
        <h2 className="text-base font-semibold text-[color:var(--mwm-navy)] border-l-4 border-[color:var(--mwm-gold)] pl-3 mb-3">Law Scenario</h2>
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
                  ? 'border-[color:var(--mwm-gold)] bg-[var(--mwm-gold-pale)] ring-1 ring-[color:var(--mwm-gold)]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
                }
              `}
            >
              <div className={`font-medium text-sm ${lawScenario === option.value ? 'text-[color:var(--mwm-navy)]' : 'text-gray-700'}`}>
                {option.label}
              </div>
              <div className="text-xs text-gray-500 mt-1">{option.description}</div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold text-[color:var(--mwm-navy)] border-l-4 border-[color:var(--mwm-gold)] pl-3 mb-4">Federal & State Tax Waterfall</h2>
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
          isMFJ={isMFJ}
          stateTaxFromHorizon={lawScenario === 'current_law' ? horizonTodayStateTax : null}
          stateTaxWithCSTFromHorizon={lawScenario === 'current_law' ? horizonTodayStateTaxWithCST : null}
          taxBasisNote={taxBasisNote}
        />
        {lawScenario === 'current_law' && acceptedStrategyTotal > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Includes {formatCurrency(acceptedStrategyTotal)} in accepted strategies
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-[color:var(--mwm-navy)] border-l-4 border-[color:var(--mwm-gold)] pl-3 mb-4">State Tax Detail</h2>
        <StateTaxPanel
          grossEstate={grossEstate}
          stateCode={stateCode}
          profileStateAbbrev={household?.state_primary}
          projectionYears={projectionYears}
          federalExemption={federalExemption}
          dbExemptions={stateExemptions}
          stateAbbrev={household?.state_primary}
          stateEstateTaxRules={stateEstateTaxRules}
          isMFJ={isMFJ}
          projectedGrossEstateByYear={projectionRowsDomicile ?? []}
          horizonTodayStateTax={horizonTodayStateTax}
          horizonAtDeathStateTax={horizonAtDeathStateTax}
          horizonAtDeathGross={horizonAtDeathGross}
          horizonAtDeathYear={
            projectionRowsDomicile?.find((r) =>
              horizonAtDeathGross != null && Math.abs((r.gross_estate ?? r.estate_incl_home ?? 0) - horizonAtDeathGross) < 50_000,
            )?.year ?? null
          }
          atDeathColumnLabel={atDeathHorizon?.headerTitle ?? null}
          projectionTimelineNote={projectionTimelineNote}
        />
      </section>

      {household?.state_primary === 'NY' && (
        <section>
          <h2 className="text-base font-semibold text-[color:var(--mwm-navy)] border-l-4 border-[color:var(--mwm-gold)] pl-3 mb-4">NY Cliff Analysis</h2>
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
