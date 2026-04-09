'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import ConsumerEstateFlowView from '@/components/estate-flow/ConsumerEstateFlowView'
import CharitableImpactCalculator from '@/components/advisor/CharitableImpactCalculator'

type Props = {
  householdId: string
  scenarioId: string | null
  household: {
    id: string
    person1_first_name: string | null
    person1_last_name: string | null
    base_case_scenario_id: string | null
  }
  scenario: {
    outputs_s1_first: any[] | null
    assumption_snapshot: any
    calculated_at: string | null
    label: string | null
  } | null
  taxConfig: {
    estate_exemption_individual: number
    estate_exemption_married: number
    estate_top_rate_pct: number
    scenario_id: string
    label: string
  } | null
}

export default function MyEstateStrategyClient({ householdId, scenarioId, household, scenario, taxConfig }: Props) {
  const rows = scenario?.outputs_s1_first ?? []
  const snapshot = scenario?.assumption_snapshot

  const finalRow = rows[rows.length - 1]
  const retirementRow = rows.find((r: any) =>
    snapshot?.person1_retirement_age && r.age_person1 >= snapshot.person1_retirement_age
  )

  const grossAtDeath = finalRow?.estate_incl_home ?? 0
  const grossAtRetirement = (retirementRow?.estate_incl_home ?? 0) > 0 ? retirementRow!.estate_incl_home : grossAtDeath
  const exemption = taxConfig?.estate_exemption_individual ?? 13_610_000
  const topRate = (taxConfig?.estate_top_rate_pct ?? 40) / 100
  const taxableEstate = Math.max(0, grossAtDeath - exemption)
  const estimatedFederalTax = Math.round(taxableEstate * topRate)

  const sunsetExemption = 7_000_000
  const taxableEstateSunset = Math.max(0, grossAtDeath - sunsetExemption)
  const estimatedFederalTaxSunset = Math.round(taxableEstateSunset * topRate)

  const costOfWaiting = Math.max(0, estimatedFederalTaxSunset - estimatedFederalTax)

  const hasScenario = rows.length > 0

  const [charitableExpanded, setCharitableExpanded] = useState(false)

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">My Estate Strategy</h1>
        <p className="mt-1 text-sm text-neutral-500">
          A simplified view of your estate plan based on your current data.
          {scenario?.calculated_at && (
            <span className="ml-1 text-neutral-400">
              Last updated {new Date(scenario.calculated_at).toLocaleDateString()}.
            </span>
          )}
        </p>
      </div>

      {!hasScenario ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <div className="text-4xl mb-3">📈</div>
          <p className="text-sm font-medium text-neutral-600">Your estate strategy has not been generated yet</p>
          <p className="text-xs text-neutral-400 mt-1">Your advisor will generate this during your next review.</p>
          <Link href="/dashboard" className="mt-4 text-sm text-indigo-600 hover:underline">
            Return to Dashboard →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                Estimated Estate at Retirement
              </p>
              <p className="text-3xl font-bold text-neutral-900">{formatDollars(grossAtRetirement)}</p>
              <p className="text-xs text-neutral-400 mt-1">Based on current growth assumptions</p>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                Estate Tax — Current Law
              </p>
              <p className={`text-3xl font-bold ${estimatedFederalTax > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {estimatedFederalTax > 0 ? formatDollars(estimatedFederalTax) : 'None est.'}
              </p>
              <p className="text-xs text-neutral-400 mt-1">Federal only · {taxConfig?.label}</p>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                Estate Tax — Sunset 2026
              </p>
              <p className={`text-3xl font-bold ${estimatedFederalTaxSunset > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {estimatedFederalTaxSunset > 0 ? formatDollars(estimatedFederalTaxSunset) : 'None est.'}
              </p>
              <p className="text-xs text-neutral-400 mt-1">If TCJA expires end of 2025</p>
            </div>
          </div>

          {costOfWaiting > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">
                    Cost of Waiting
                  </p>
                  <p className="text-3xl font-bold text-amber-800">{formatDollars(costOfWaiting)}</p>
                  <p className="text-sm text-amber-700 mt-2">
                    The difference between your estate tax under current law versus sunset 2026.
                    Planning now through gifting, trusts, or other strategies can reduce this exposure.
                  </p>
                </div>
                <Link
                  href="/my-advisor"
                  className="shrink-0 rounded-lg bg-amber-700 px-4 py-2 text-xs font-medium text-white hover:bg-amber-800 transition"
                >
                  Talk to my advisor →
                </Link>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
            <ConsumerEstateFlowView householdId={householdId} scenarioId={scenarioId} />
          </div>

          <DisclaimerBanner context="estate strategy" />
        </div>
      )}

      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            Charitable Planning — What If I Gave?
          </h2>
          <button
            type="button"
            onClick={() => setCharitableExpanded((o) => !o)}
            className="text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1"
          >
            {charitableExpanded ? '▲ Collapse' : '▼ Explore'}
          </button>
        </div>
        {charitableExpanded && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
            <CharitableImpactCalculator householdId={householdId} />
          </div>
        )}
      </section>
    </div>
  )
}

function formatDollars(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}
