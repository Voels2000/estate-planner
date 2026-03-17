'use client'

import { useState } from 'react'
import type { YearRow } from '@/lib/calculations/projection-complete'

function formatDollars(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function SummaryCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: 'green' | 'red' | 'amber'
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p
        className={`mt-1 text-xl font-bold ${
          highlight === 'green'
            ? 'text-green-600'
            : highlight === 'red'
              ? 'text-red-600'
              : highlight === 'amber'
                ? 'text-amber-600'
                : 'text-neutral-900'
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function CompleteClient({
  rows,
  person1Name,
  person2Name,
}: {
  rows: YearRow[]
  person1Name: string
  person2Name: string | null
}) {
  const [activeTab, setActiveTab] = useState<'table' | 'chart'>('table')

  if (!rows?.length) {
    return (
      <div className="p-8 text-center text-gray-500">
        No projection data available.
      </div>
    )
  }

  const first = rows[0]
  const last = rows[rows.length - 1]
  const peakNetWorth = Math.max(...rows.map((r) => r.net_worth))
  const peakRow = rows.find((r) => r.net_worth === peakNetWorth)
  const minNetWorth = last?.net_worth ?? 0
  const fundsOutlast = minNetWorth > 0

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">Complete Projection</h1>
      <p className="text-sm text-neutral-500 mb-8">
        {person2Name
          ? `${person1Name} & ${person2Name} — year-by-year income, taxes, expenses, and net worth`
          : `${person1Name} — year-by-year income, taxes, expenses, and net worth`}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="Start"
          value={`${first.year}`}
          sub={`${person1Name} age ${first.age_person1}${person2Name ? `, ${person2Name} age ${first.age_person2 ?? '—'}` : ''}`}
        />
        <SummaryCard
          label="End"
          value={`${last.year}`}
          sub={`${person1Name} age ${last.age_person1}${person2Name ? `, ${person2Name} age ${last.age_person2 ?? '—'}` : ''}`}
        />
        <SummaryCard
          label="Peak net worth"
          value={formatDollars(peakNetWorth)}
          sub={peakRow ? `Year ${peakRow.year}` : undefined}
        />
        <SummaryCard
          label="Funds outlast"
          value={fundsOutlast ? 'Yes ✓' : 'No ✗'}
          sub={fundsOutlast ? 'On track' : 'Review plan'}
          highlight={fundsOutlast ? 'green' : 'red'}
        />
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm">
        <div className="flex border-b border-neutral-200 px-4 pt-4 gap-1">
          {(['table', 'chart'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg capitalize transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-neutral-900 text-neutral-900'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'table' ? (
            <div className="overflow-auto max-h-[70vh]">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-white border-b border-neutral-200">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    <th className="pb-2 pr-3">Year</th>
                    <th className="pb-2 pr-3">Age 1</th>
                    {person2Name && <th className="pb-2 pr-3">Age 2</th>}
                    <th className="pb-2 pr-3">Income</th>
                    <th className="pb-2 pr-3">Tax</th>
                    <th className="pb-2 pr-3">Expenses</th>
                    <th className="pb-2 pr-3">Net CF</th>
                    <th className="pb-2">Net worth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {rows.map((r) => (
                    <tr key={r.year} className="text-neutral-700">
                      <td className="py-1.5 pr-3 font-medium">{r.year}</td>
                      <td className="py-1.5 pr-3">{r.age_person1}</td>
                      {person2Name && (
                        <td className="py-1.5 pr-3">{r.age_person2 ?? '—'}</td>
                      )}
                      <td className="py-1.5 pr-3 text-green-600">
                        {formatDollars(r.income_total)}
                      </td>
                      <td className="py-1.5 pr-3 text-amber-600">
                        {formatDollars(r.tax_total)}
                      </td>
                      <td className="py-1.5 pr-3 text-red-500">
                        {formatDollars(r.expenses_total)}
                      </td>
                      <td
                        className={`py-1.5 pr-3 font-medium ${r.net_cash_flow >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {r.net_cash_flow >= 0 ? '+' : ''}
                        {formatDollars(r.net_cash_flow)}
                      </td>
                      <td
                        className={`py-1.5 font-semibold ${r.net_worth < 1000 ? 'text-red-600' : 'text-neutral-900'}`}
                      >
                        {formatDollars(r.net_worth)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-end gap-0.5 h-64 w-full px-2">
              {rows
                .filter((_, i) => rows.length <= 50 || i % Math.ceil(rows.length / 50) === 0)
                .map((r) => {
                  const pct =
                    peakNetWorth > 0 ? (r.net_worth / peakNetWorth) * 100 : 0
                  return (
                    <div
                      key={r.year}
                      className="flex-1 flex flex-col items-center gap-1 group"
                    >
                      <div
                        className="relative w-full flex items-end"
                        style={{ height: '200px' }}
                      >
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 hidden group-hover:block whitespace-nowrap rounded-lg bg-neutral-900 px-2 py-1 text-xs text-white shadow-lg">
                          {r.year}: {formatDollars(r.net_worth)}
                        </div>
                        <div
                          className={`w-full rounded-t transition-all ${
                            r.net_worth < 1000
                              ? 'bg-red-400'
                              : r.net_worth < peakNetWorth * 0.2
                                ? 'bg-amber-400'
                                : 'bg-neutral-700'
                          }`}
                          style={{ height: `${Math.max(pct, 1)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-neutral-400">
                        {r.year}
                      </span>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
