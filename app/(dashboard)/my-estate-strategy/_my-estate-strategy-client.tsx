'use client'

import Link from 'next/link'
import ConsumerEstateFlowView from '@/components/estate-flow/ConsumerEstateFlowView'

type Props = {
  householdId: string
  scenarioId: string | null
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

export default function MyEstateStrategyClient({ householdId, scenarioId, scenario, taxConfig }: Props) {
  const rows = scenario?.outputs_s1_first ?? []
  const snapshot = scenario?.assumption_snapshot

  const firstRow = rows[0]
  const estateToday = firstRow?.estate_incl_home ?? 0
  const stateTaxToday = Number(firstRow?.estate_tax_state ?? 0)

  const finalRow = rows[rows.length - 1]
  const retirementRow = rows.find((r: any) =>
    snapshot?.person1_retirement_age && r.age_person1 >= snapshot.person1_retirement_age
  )

  const grossAtDeath = finalRow?.estate_incl_home ?? 0
  const grossAtRetirement = (retirementRow?.estate_incl_home ?? 0) > 0 ? retirementRow!.estate_incl_home : grossAtDeath
  const hasSpouse = snapshot?.has_spouse ?? false
  const exemptionWithPortability = hasSpouse
    ? (taxConfig?.estate_exemption_married ?? 27_220_000)
    : (taxConfig?.estate_exemption_individual ?? 13_610_000)
  const topRate = (taxConfig?.estate_top_rate_pct ?? 40) / 100
  const taxableEstateWithPortability = Math.max(0, estateToday - exemptionWithPortability)
  const estimatedFederalTaxWithPortability = Math.round(taxableEstateWithPortability * topRate)

  const individualExemption = taxConfig?.estate_exemption_individual ?? 13_610_000
  const taxableEstateNoPortability = Math.max(0, estateToday - individualExemption)
  const estimatedFederalTaxNoPortability = Math.round(taxableEstateNoPortability * topRate)

  const sunsetExemption = hasSpouse ? 14_000_000 : 7_000_000
  const taxableEstateSunset = Math.max(0, estateToday - sunsetExemption)
  const estimatedFederalTaxSunset = Math.round(taxableEstateSunset * topRate)

  const planningGap = Math.max(estimatedFederalTaxNoPortability, stateTaxToday)

  const hasScenario = rows.length > 0

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
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                Estimated Estate at Retirement
              </p>
              <p className="text-3xl font-bold text-neutral-900">{formatDollars(grossAtRetirement)}</p>
              <p className="text-xs text-neutral-400 mt-1">Based on current growth assumptions</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                  Federal Tax — With Portability
                </p>
                <p
                  className={`text-3xl font-bold ${estimatedFederalTaxWithPortability > 0 ? 'text-red-600' : 'text-emerald-600'}`}
                >
                  {formatDollars(estimatedFederalTaxWithPortability)}
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  Requires filing estate tax return within 9 months of first death
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                  Federal Tax — Without Portability
                </p>
                <p
                  className={`text-3xl font-bold ${estimatedFederalTaxNoPortability > 0 ? 'text-red-600' : 'text-emerald-600'}`}
                >
                  {formatDollars(estimatedFederalTaxNoPortability)}
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  If no estate tax return is filed at first death
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-500 mt-2">
              These are illustrative scenarios. Your advisor or attorney can determine which applies to your situation.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                  Estate Tax — Sunset 2026
                </p>
                <p className={`text-3xl font-bold ${estimatedFederalTaxSunset > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {estimatedFederalTaxSunset > 0 ? formatDollars(estimatedFederalTaxSunset) : 'None est.'}
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  Federal exemption decreases December 31, 2026. Review with your advisor before year end.
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">NY State Tax</p>
                <p
                  className={`text-3xl font-bold ${stateTaxToday > 0 ? 'text-red-600' : 'text-neutral-600'}`}
                >
                  {stateTaxToday > 0 ? formatDollars(stateTaxToday) : 'See Estate Tax tab for details'}
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  NY does not recognize federal portability. Review with your attorney.
                </p>
              </div>
            </div>
          </div>

          {planningGap > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">Planning Gap</p>
                  <p className="text-3xl font-bold text-amber-800">{formatDollars(planningGap)}</p>
                  <p className="text-sm text-amber-700 mt-2">
                    Potential exposure to explore with your advisor or attorney
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
        </div>
      )}
    </div>
  )
}

function formatDollars(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}
