'use client'

import { useState } from 'react'
import type { YearRow } from '@/lib/calculations/projection-complete'

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000)  return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)      return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function firstNameOnly(fullName: string | null | undefined): string {
  if (!fullName) return ''
  return fullName.trim().split(' ')[0]
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: 'green' | 'red' | 'amber'
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${
        highlight === 'green' ? 'text-green-600'
        : highlight === 'red' ? 'text-red-600'
        : highlight === 'amber' ? 'text-amber-600'
        : 'text-neutral-900'
      }`}>{value}</p>
      {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Column group toggle button ───────────────────────────────────────────────

function GroupToggle({
  label, expanded, onToggle, color,
}: {
  label: string
  expanded: boolean
  onToggle: () => void
  color: string
}) {
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border transition-all ${color}`}
    >
      {label}
      <span className="text-[10px]">{expanded ? '▲' : '▼'}</span>
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CompleteClient({
  rows,
  person1Name,
  person2Name,
  hasSpouse,
}: {
  rows: YearRow[]
  person1Name: string
  person2Name: string | null
  hasSpouse: boolean
}) {
  const p1 = firstNameOnly(person1Name)
  const p2 = hasSpouse ? firstNameOnly(person2Name) : null

  // ── Pagination ─────────────────────────────────────────────────────────────
  const PAGE_SIZE = 10
  const [pageStart, setPageStart] = useState(0)
  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const currentPage = Math.floor(pageStart / PAGE_SIZE)
  const visibleRows = rows.slice(pageStart, pageStart + PAGE_SIZE)

  // ── Column group expand state ──────────────────────────────────────────────
  const [expandP1,    setExpandP1]    = useState(false)
  const [expandP2,    setExpandP2]    = useState(false)
  const [expandRE,    setExpandRE]    = useState(false)
  const [expandEstate,setExpandEstate]= useState(false)
  const [expandTax,   setExpandTax]   = useState(false)

  if (!rows?.length) {
    return (
      <div className="p-8 text-center text-gray-500">
        No projection data available.
      </div>
    )
  }

  const first = rows[0]
  const last  = rows[rows.length - 1]
  const peakNetWorth = Math.max(...rows.map(r => r.net_worth))
  const peakRow      = rows.find(r => r.net_worth === peakNetWorth)
  const fundsOutlast = (last?.net_worth ?? 0) > 0
  const peakEstate   = Math.max(...rows.map(r => r.estate_incl_home ?? 0))

  return (
    <div className="p-6 max-w-[1600px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">Lifetime Snapshot</h1>
      <p className="text-sm text-neutral-500 mb-6">
        {p2
          ? `${p1} & ${p2} — year-by-year income, taxes, expenses, assets, and estate`
          : `${p1} — year-by-year income, taxes, expenses, assets, and estate`}
      </p>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        <SummaryCard
          label="Start"
          value={`${first.year}`}
          sub={`${p1} age ${first.age_person1}${p2 ? `, ${p2} age ${first.age_person2 ?? '—'}` : ''}`}
        />
        <SummaryCard
          label="End"
          value={`${last.year}`}
          sub={`${p1} age ${last.age_person1}${p2 ? `, ${p2} age ${last.age_person2 ?? '—'}` : ''}`}
        />
        <SummaryCard
          label="Peak Net Worth"
          value={fmt(peakNetWorth)}
          sub={peakRow ? `Year ${peakRow.year}` : undefined}
        />
        <SummaryCard
          label="Peak Estate Value"
          value={fmt(peakEstate)}
          sub="incl. primary home"
        />
        <SummaryCard
          label="Funds Outlast"
          value={fundsOutlast ? 'Yes ✓' : 'No ✗'}
          sub={fundsOutlast ? 'On track' : 'Review plan'}
          highlight={fundsOutlast ? 'green' : 'red'}
        />
      </div>

      {/* ── Column group toggles ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs text-neutral-400 font-medium mr-1">Expand:</span>
        <GroupToggle
          label={`${p1}`}
          expanded={expandP1}
          onToggle={() => setExpandP1(v => !v)}
          color="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
        />
        {p2 && (
          <GroupToggle
            label={`${p2}`}
            expanded={expandP2}
            onToggle={() => setExpandP2(v => !v)}
            color="border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
          />
        )}
        <GroupToggle
          label="Tax"
          expanded={expandTax}
          onToggle={() => setExpandTax(v => !v)}
          color="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
        />
        <GroupToggle
          label="Real Estate"
          expanded={expandRE}
          onToggle={() => setExpandRE(v => !v)}
          color="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
        />
        <GroupToggle
          label="Estate"
          expanded={expandEstate}
          onToggle={() => setExpandEstate(v => !v)}
          color="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
        />
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">

            {/* ── Group header row ─────────────────────────────────────────── */}
            <thead>
              <tr className="border-b border-neutral-100">
                {/* Always-visible columns */}
                <th colSpan={3} className="pb-1 pt-3 px-3" />

                {/* Person 1 group */}
                <th
                  colSpan={expandP1 ? 6 : 1}
                  className="pb-1 pt-3 px-2 text-center"
                >
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {p1}
                  </span>
                </th>

                {/* Person 2 group */}
                {p2 && (
                  <th
                    colSpan={expandP2 ? 6 : 1}
                    className="pb-1 pt-3 px-2 text-center"
                  >
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                      {p2}
                    </span>
                  </th>
                )}

                {/* Tax group */}
                <th
                  colSpan={expandTax ? 7 : 1}
                  className="pb-1 pt-3 px-2 text-center"
                >
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    Tax
                  </span>
                </th>

                {/* Always-visible: Expenses + Net CF */}
                <th colSpan={2} className="pb-1 pt-3 px-3" />

                {/* Real Estate group */}
                <th
                  colSpan={expandRE ? 3 : 1}
                  className="pb-1 pt-3 px-2 text-center"
                >
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Real Estate
                  </span>
                </th>

                {/* Estate group */}
                <th
                  colSpan={expandEstate ? 2 : 1}
                  className="pb-1 pt-3 px-2 text-center"
                >
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    Estate
                  </span>
                </th>

                {/* Net Worth */}
                <th className="pb-1 pt-3 px-3" />
              </tr>

              {/* ── Column label row ──────────────────────────────────────── */}
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 border-b border-neutral-200">
                {/* Always visible */}
                <th className="py-2 px-3 whitespace-nowrap">Year</th>
                <th className="py-2 px-2 whitespace-nowrap">{p1} Age</th>
                {p2 && <th className="py-2 px-2 whitespace-nowrap">{p2} Age</th>}

                {/* Person 1 */}
                <th className="py-2 px-2 whitespace-nowrap text-blue-600">Income</th>
                {expandP1 && <>
                  <th className="py-2 px-2 whitespace-nowrap text-blue-500">Earned</th>
                  <th className="py-2 px-2 whitespace-nowrap text-blue-500">SS</th>
                  <th className="py-2 px-2 whitespace-nowrap text-blue-500">RMD</th>
                  <th className="py-2 px-2 whitespace-nowrap text-blue-500">Other</th>
                  <th className="py-2 px-2 whitespace-nowrap text-blue-500">Assets</th>
                </>}

                {/* Person 2 */}
                {p2 && <>
                  <th className="py-2 px-2 whitespace-nowrap text-violet-600">Income</th>
                  {expandP2 && <>
                    <th className="py-2 px-2 whitespace-nowrap text-violet-500">Earned</th>
                    <th className="py-2 px-2 whitespace-nowrap text-violet-500">SS</th>
                    <th className="py-2 px-2 whitespace-nowrap text-violet-500">RMD</th>
                    <th className="py-2 px-2 whitespace-nowrap text-violet-500">Other</th>
                    <th className="py-2 px-2 whitespace-nowrap text-violet-500">Assets</th>
                  </>}
                </>}

                {/* Tax */}
                <th className="py-2 px-2 whitespace-nowrap text-amber-600">Tax Total</th>
                {expandTax && <>
                  <th className="py-2 px-2 whitespace-nowrap text-amber-500">Federal</th>
                  <th className="py-2 px-2 whitespace-nowrap text-amber-500">State</th>
                  <th className="py-2 px-2 whitespace-nowrap text-amber-500">Cap Gains</th>
                  <th className="py-2 px-2 whitespace-nowrap text-amber-500">NIIT</th>
                  <th className="py-2 px-2 whitespace-nowrap text-amber-500">Payroll</th>
                  <th className="py-2 px-2 whitespace-nowrap text-amber-500">IRMAA</th>
                </>}

                {/* Always visible */}
                <th className="py-2 px-2 whitespace-nowrap">Expenses</th>
                <th className="py-2 px-2 whitespace-nowrap">Net CF</th>

                {/* Real Estate */}
                <th className="py-2 px-2 whitespace-nowrap text-emerald-600">RE Total</th>
                {expandRE && <>
                  <th className="py-2 px-2 whitespace-nowrap text-emerald-500">Primary</th>
                  <th className="py-2 px-2 whitespace-nowrap text-emerald-500">Other RE</th>
                </>}

                {/* Estate */}
                <th className="py-2 px-2 whitespace-nowrap text-rose-600">Incl. Home</th>
                {expandEstate && (
                  <th className="py-2 px-2 whitespace-nowrap text-rose-500">Excl. Home</th>
                )}

                {/* Net Worth */}
                <th className="py-2 px-3 whitespace-nowrap">Net Worth</th>
              </tr>
            </thead>

            {/* ── Body ──────────────────────────────────────────────────────── */}
            <tbody className="divide-y divide-neutral-100">
              {visibleRows.map((r, i) => {
                const isEven = i % 2 === 0
                const p1Income = (r.income_earned_p1 ?? 0) + r.income_ss_person1 + (r.income_rmd_p1 ?? 0) + (r.income_other_p1 ?? 0)
                const p2Income = (r.income_earned_p2 ?? 0) + r.income_ss_person2 + (r.income_rmd_p2 ?? 0) + (r.income_other_p2 ?? 0)
                const p1Assets = (r.assets_p1_total ?? 0)
                const p2Assets = (r.assets_p2_total ?? 0)
                const irmaaTotal = (r.irmaa_part_b ?? 0) + (r.irmaa_part_d ?? 0)
                const reTotal = (r.real_estate_total ?? 0)

                return (
                  <tr
                    key={r.year}
                    className={`text-neutral-700 ${isEven ? 'bg-white' : 'bg-neutral-50'} hover:bg-blue-50/30 transition-colors`}
                  >
                    {/* Always visible */}
                    <td className="py-2 px-3 font-semibold text-neutral-900">{r.year}</td>
                    <td className="py-2 px-2 text-neutral-500">{r.age_person1}</td>
                    {p2 && <td className="py-2 px-2 text-neutral-500">{r.age_person2 ?? '—'}</td>}

                    {/* Person 1 */}
                    <td className="py-2 px-2 text-blue-700 font-medium">{fmt(p1Income)}</td>
                    {expandP1 && <>
                      <td className="py-2 px-2 text-blue-600">{fmt(r.income_earned_p1 ?? 0)}</td>
                      <td className="py-2 px-2 text-blue-600">{fmt(r.income_ss_person1)}</td>
                      <td className="py-2 px-2 text-blue-600">{fmt(r.income_rmd_p1 ?? 0)}</td>
                      <td className="py-2 px-2 text-blue-600">{fmt(r.income_other_p1 ?? 0)}</td>
                      <td className="py-2 px-2 text-blue-600">{fmt(p1Assets)}</td>
                    </>}

                    {/* Person 2 */}
                    {p2 && <>
                      <td className="py-2 px-2 text-violet-700 font-medium">{fmt(p2Income)}</td>
                      {expandP2 && <>
                        <td className="py-2 px-2 text-violet-600">{fmt(r.income_earned_p2 ?? 0)}</td>
                        <td className="py-2 px-2 text-violet-600">{fmt(r.income_ss_person2)}</td>
                        <td className="py-2 px-2 text-violet-600">{fmt(r.income_rmd_p2 ?? 0)}</td>
                        <td className="py-2 px-2 text-violet-600">{fmt(r.income_other_p2 ?? 0)}</td>
                        <td className="py-2 px-2 text-violet-600">{fmt(p2Assets)}</td>
                      </>}
                    </>}

                    {/* Tax */}
                    <td className="py-2 px-2 text-amber-700 font-medium">{fmt(r.tax_total)}</td>
                    {expandTax && <>
                      <td className="py-2 px-2 text-amber-600">{fmt(r.tax_federal)}</td>
                      <td className="py-2 px-2 text-amber-600">{fmt(r.tax_state)}</td>
                      <td className="py-2 px-2 text-amber-600">{fmt(r.tax_capital_gains)}</td>
                      <td className="py-2 px-2 text-amber-600">{fmt(r.tax_niit)}</td>
                      <td className="py-2 px-2 text-amber-600">{fmt(r.tax_payroll)}</td>
                      <td className="py-2 px-2 text-amber-600">{fmt(irmaaTotal)}</td>
                    </>}

                    {/* Always visible */}
                    <td className="py-2 px-2 text-red-500">{fmt(r.expenses_total)}</td>
                    <td className={`py-2 px-2 font-semibold ${r.net_cash_flow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {r.net_cash_flow >= 0 ? '+' : ''}{fmt(r.net_cash_flow)}
                    </td>

                    {/* Real Estate */}
                    <td className="py-2 px-2 text-emerald-700 font-medium">{fmt(reTotal)}</td>
                    {expandRE && <>
                      <td className="py-2 px-2 text-emerald-600">{fmt(r.real_estate_primary ?? 0)}</td>
                      <td className="py-2 px-2 text-emerald-600">{fmt(r.real_estate_other ?? 0)}</td>
                    </>}

                    {/* Estate */}
                    <td className="py-2 px-2 text-rose-700 font-medium">{fmt(r.estate_incl_home ?? 0)}</td>
                    {expandEstate && (
                      <td className="py-2 px-2 text-rose-600">{fmt(r.estate_excl_home ?? 0)}</td>
                    )}

                    {/* Net Worth */}
                    <td className={`py-2 px-3 font-bold ${(r.net_worth ?? 0) < 1000 ? 'text-red-600' : 'text-neutral-900'}`}>
                      {fmt(r.net_worth)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200">
          <p className="text-xs text-neutral-400">
            Years {rows[pageStart]?.year}–{rows[Math.min(pageStart + PAGE_SIZE - 1, rows.length - 1)]?.year}
            {' '}· Page {currentPage + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={pageStart === 0}
              onClick={() => setPageStart(p => Math.max(0, p - PAGE_SIZE))}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            <button
              disabled={pageStart + PAGE_SIZE >= rows.length}
              onClick={() => setPageStart(p => Math.min(rows.length - PAGE_SIZE, p + PAGE_SIZE))}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* ── Footer note ────────────────────────────────────────────────────── */}
      <p className="mt-4 text-xs text-neutral-400 text-center">
        Financial assets grow at investment rate · Real estate grows at inflation rate · Click group labels above to expand detail columns
      </p>
    </div>
  )
}
