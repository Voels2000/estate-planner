// Sprint 65 — schedule tab: move breakeven from domicileEngine (legacy shape)
'use client'

import type { MoveBreakevenResult } from '@/lib/projection/domicileEngine'

interface Props {
  result: MoveBreakevenResult | null
  isLoading?: boolean
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function MoveBreakevenLegacyPanel({ result, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
        <div className="h-4 bg-slate-100 rounded w-48 mb-4" />
        <div className="h-32 bg-slate-50 rounded" />
      </div>
    )
  }

  if (!result) return null

  const { from_state, to_state, crossover_year, never_breaks_even,
          year_by_year, total_savings_at_death, recommendation } = result

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          Move Breakeven Analysis — {from_state} → {to_state}
        </h3>
        {!never_breaks_even && crossover_year && (
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">
            Breaks even {crossover_year}
          </span>
        )}
        {never_breaks_even && (
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
            Does not break even
          </span>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Crossover Year</p>
          <p className="text-xl font-bold text-slate-900 mt-1">
            {crossover_year ?? '—'}
          </p>
        </div>
        <div className={`rounded-lg p-3 text-center ${total_savings_at_death > 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Lifetime Savings</p>
          <p className={`text-xl font-bold mt-1 ${total_savings_at_death > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {fmt(total_savings_at_death)}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Move To</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{to_state}</p>
        </div>
      </div>

      {/* Recommendation */}
      <div className={`rounded-lg px-4 py-3 text-sm ${
        never_breaks_even
          ? 'bg-slate-50 text-slate-600'
          : 'bg-blue-50 text-blue-800'
      }`}>
        {recommendation}
      </div>

      {/* Year-by-year table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left text-xs font-semibold text-slate-500 pb-2">Year</th>
              <th className="text-left text-xs font-semibold text-slate-500 pb-2">Domicile</th>
              <th className="text-right text-xs font-semibold text-slate-500 pb-2">Estate</th>
              <th className="text-right text-xs font-semibold text-slate-500 pb-2">State Tax</th>
              <th className="text-right text-xs font-semibold text-slate-500 pb-2">Cumulative Savings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {year_by_year.map(row => {
              const isTransitionYear = row.year === result.transition_year
              const isCrossover = row.year === crossover_year
              return (
                <tr
                  key={row.year}
                  className={`hover:bg-slate-50 ${
                    isCrossover ? 'bg-emerald-50' : isTransitionYear ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="py-2 font-medium text-slate-800">
                    {row.year}
                    {isTransitionYear && (
                      <span className="ml-1.5 text-xs bg-blue-100 text-blue-700 px-1 rounded">Move</span>
                    )}
                    {isCrossover && (
                      <span className="ml-1.5 text-xs bg-emerald-100 text-emerald-700 px-1 rounded">✓ Breakeven</span>
                    )}
                  </td>
                  <td className="py-2 text-slate-600">{row.domicile}</td>
                  <td className="py-2 text-right text-slate-600">{fmt(row.gross_estate)}</td>
                  <td className="py-2 text-right text-slate-700">{fmt(row.state_tax)}</td>
                  <td className={`py-2 text-right font-medium ${
                    row.cumulative_tax_savings > 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}>
                    {fmt(row.cumulative_tax_savings)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Cumulative savings include estimated move costs. State tax calculated using current-law exemptions.
        Consult a qualified estate attorney before making domicile changes.
      </p>
    </div>
  )
}
