// components/advisor/StateTaxPanel.tsx
// Sprint 64 - Year-by-year state tax display in StrategyTab
'use client'

import {
  getStateExemptionForYear,
  calculateStateEstateTax,
  STATE_HAS_ESTATE_TAX,
  STATE_SPECIAL_RULES,
  getEstateTaxDisplayStateName,
  type DbStateExemption,
  type StateTaxCode,
} from '@/lib/projection/stateRegistry'

interface Props {
  grossEstate:      number
  stateCode:        StateTaxCode
  /** Household profile `state_primary` — resolves display name when modeled code is `other` (e.g. CA → California). */
  profileStateAbbrev?: string | null
  projectionYears?: number[]
  federalExemption?: number
  dsue?:            number
  dbExemptions?:    DbStateExemption[]
}

const DEFAULT_YEARS = [2025, 2026, 2027, 2028, 2029, 2030]

function fmt(n: number) {
  if (!isFinite(n)) return 'N/A'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function pct(n: number) {
  return (n * 100).toFixed(1) + '%'
}

export default function StateTaxPanel({
  grossEstate,
  stateCode,
  profileStateAbbrev,
  projectionYears = DEFAULT_YEARS,
  federalExemption,
  dsue = 0,
  dbExemptions,
}: Props) {
  const hasStateTax = Boolean(STATE_HAS_ESTATE_TAX[stateCode])
  const stateName = getEstateTaxDisplayStateName(stateCode, profileStateAbbrev)

  if (!hasStateTax) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">{stateName} Estate Tax</h3>
        <div className="bg-emerald-50 rounded-lg p-4 text-center">
          <p className="text-emerald-800 font-semibold">{stateName} has no state estate tax.</p>
          <p className="text-emerald-600 text-sm mt-1">$0 state estate tax liability in all projection years.</p>
        </div>
      </div>
    )
  }

  const rows = projectionYears.map(year => {
    const result = calculateStateEstateTax({ grossEstate, stateCode, year, federalExemption, dsue, dbExemptions })
    const exemption = getStateExemptionForYear(stateCode, year, federalExemption, dbExemptions)
    return { year, exemption, ...result }
  })

  const specialRules = STATE_SPECIAL_RULES[stateCode] ?? []
  const hasNyCliff   = rows.some(r => r.nyCliffTriggered)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          {stateName} Estate Tax
        </h3>
        <div className="flex gap-2 flex-wrap justify-end">
          {specialRules.includes('no_portability') && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">No portability</span>
          )}
          {specialRules.includes('ny_cliff') && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">NY Cliff rule</span>
          )}
          {specialRules.includes('inflation_indexed') && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Inflation-indexed</span>
          )}
          {specialRules.includes('tracks_federal') && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Tracks federal</span>
          )}
        </div>
      </div>

      {/* NY cliff warning */}
      {hasNyCliff && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
          <strong>NY Cliff Triggered</strong> — Estate exceeds 105% of exemption in one or more years.
          The full estate is subject to tax with no exemption offset. Immediate planning action recommended.
        </div>
      )}

      {/* Year-by-year table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left text-xs font-semibold text-slate-500 pb-2">Year</th>
              <th className="text-right text-xs font-semibold text-slate-500 pb-2">Exemption</th>
              <th className="text-right text-xs font-semibold text-slate-500 pb-2">Taxable Estate</th>
              <th className="text-right text-xs font-semibold text-slate-500 pb-2">State Tax</th>
              <th className="text-right text-xs font-semibold text-slate-500 pb-2">Eff. Rate</th>
              {specialRules.includes('ny_cliff') && (
                <th className="text-center text-xs font-semibold text-slate-500 pb-2">Cliff</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(row => (
              <tr key={row.year} className={`hover:bg-slate-50 ${row.nyCliffTriggered ? 'bg-red-50' : ''}`}>
                <td className="py-2.5 font-medium text-slate-800">{row.year}</td>
                <td className="py-2.5 text-right text-slate-600">{fmt(row.exemption)}</td>
                <td className="py-2.5 text-right text-slate-600">{fmt(row.taxableEstate)}</td>
                <td className="py-2.5 text-right font-semibold text-slate-800">
                  {row.stateTax > 0 ? (
                    <span className="text-red-700">{fmt(row.stateTax)}</span>
                  ) : (
                    <span className="text-emerald-700">$0</span>
                  )}
                </td>
                <td className="py-2.5 text-right text-slate-500">{pct(row.effectiveRate)}</td>
                {specialRules.includes('ny_cliff') && (
                  <td className="py-2.5 text-center">
                    {row.nyCliffTriggered ? (
                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">⚠ Yes</span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Based on current gross estate of {fmt(grossEstate)}.
        {stateName} estate tax rates are approximate; consult a qualified estate attorney for precise calculations.
      </p>
    </div>
  )
}
