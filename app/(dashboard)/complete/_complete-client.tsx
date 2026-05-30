'use client'

// ─────────────────────────────────────────
// Menu: Retirement Planning > Lifetime Snapshot
// Route: /complete
// ─────────────────────────────────────────

import { useState } from 'react'
import type { YearRow } from '@/lib/calculations/projection-complete'
import { displayPersonFirstName } from '@/lib/display-person-name'
import { PLANNING_SURFACES } from '@/lib/planning/planningSurfaces'
import { PlanningSurfaceNav } from '@/app/(dashboard)/_components/PlanningSurfaceNav'
import { PlanningProjectionEmptyState } from '@/app/(dashboard)/_components/PlanningProjectionEmptyState'
import {
  PLANNING_MISSING_PROJECTION_ACTIONS_TIER2,
  PLANNING_MISSING_PROJECTION_DESCRIPTION,
} from '@/lib/planning/planningEmptyState'

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ value, max, min }: { value: number; max: number; min: number }) {
  const range = max - min || 1
  const pct = Math.round(((value - min) / range) * 100)
  return (
    <div className="h-3 w-10 overflow-hidden rounded-sm bg-neutral-100">
      <div className="h-full rounded-sm bg-emerald-500" style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

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
      {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
    </div>
  )
}

// ─── Column group toggle button ───────────────────────────────────────────────

function GroupToggle({
  label,
  expanded,
  onToggle,
  color,
}: {
  label: string
  expanded: boolean
  onToggle: () => void
  color: string
}) {
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold transition-all ${color}`}
    >
      {label}
      <span className="text-[10px]">{expanded ? '▲' : '▼'}</span>
    </button>
  )
}

function personColumnCount(
  expand: boolean,
  showSs: boolean,
  showRmd: boolean,
): number {
  return 1 + (showSs ? 1 : 0) + (showRmd ? 1 : 0) + (expand ? 3 : 0)
}

function rowSurface(
  r: YearRow,
  rowIndex: number,
  inflectionYears: Set<number>,
): { tr: string; sticky: string } {
  const isInflection = inflectionYears.has(r.year)
  const isDecadeStart = r.year % 10 === 0
  const hasRmdShortfall = (r.rmd_shortfall ?? 0) > 0

  if (hasRmdShortfall || isInflection) {
    return {
      tr: 'group bg-amber-50 border-l-2 border-l-amber-400 hover:bg-amber-50/90',
      sticky: 'bg-amber-50 group-hover:bg-amber-50/90',
    }
  }
  if (isDecadeStart) {
    return {
      tr: 'group bg-neutral-50 hover:bg-blue-50/30',
      sticky: 'bg-neutral-50 group-hover:bg-blue-50/30',
    }
  }
  const isEven = rowIndex % 2 === 0
  return {
    tr: `group ${isEven ? 'bg-white' : 'bg-neutral-50'} hover:bg-blue-50/30 transition-colors`,
    sticky: `${isEven ? 'bg-white' : 'bg-neutral-50'} group-hover:bg-blue-50/30`,
  }
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
  const p1 = displayPersonFirstName(person1Name)
  const p2 = hasSpouse ? displayPersonFirstName(person2Name) : null

  const PAGE_SIZE = 10
  const [activePage, setActivePage] = useState(0)

  const [expandP1, setExpandP1] = useState(false)
  const [expandP2, setExpandP2] = useState(false)
  const [expandRE, setExpandRE] = useState(false)
  const [expandEstate, setExpandEstate] = useState(false)
  const [expandTax, setExpandTax] = useState(false)

  if (!rows?.length) {
    return (
      <PlanningProjectionEmptyState
        title="No projection data yet"
        description={PLANNING_MISSING_PROJECTION_DESCRIPTION}
        actions={[...PLANNING_MISSING_PROJECTION_ACTIONS_TIER2]}
        icon="📈"
      />
    )
  }

  const pageStart = activePage * PAGE_SIZE
  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const visibleRows = rows.slice(pageStart, pageStart + PAGE_SIZE)

  const first = rows[0]
  const last = rows[rows.length - 1]
  const peakNetWorth = Math.max(...rows.map((r) => r.net_worth))
  const peakRow = rows.find((r) => r.net_worth === peakNetWorth)
  const fundsOutlast = (last?.net_worth ?? 0) > 0
  const peakEstate = Math.max(...rows.map((r) => r.estate_incl_home ?? 0))
  const maxNetWorth = Math.max(...rows.map((r) => r.net_worth ?? 0))
  const minNetWorth = Math.min(...rows.map((r) => r.net_worth ?? 0))

  const anyP1SSOnPage = visibleRows.some((r) => (r.income_ss_person1 ?? 0) > 0)
  const anyP2SSOnPage = visibleRows.some((r) => (r.income_ss_person2 ?? 0) > 0)
  const anyP1RMDOnPage = visibleRows.some((r) => (r.income_rmd_p1 ?? 0) > 0)
  const anyP2RMDOnPage = visibleRows.some((r) => (r.income_rmd_p2 ?? 0) > 0)

  const p1ColSpan = personColumnCount(expandP1, anyP1SSOnPage, anyP1RMDOnPage)
  const p2ColSpan = personColumnCount(expandP2, anyP2SSOnPage, anyP2RMDOnPage)
  const leadingColSpan = p2 ? 4 : 3

  const inflectionYears = new Set<number>()
  const firstP1SS = rows.find((r) => (r.income_ss_person1 ?? 0) > 0)
  const firstP2SS = rows.find((r) => (r.income_ss_person2 ?? 0) > 0)
  const firstP1RMD = rows.find((r) => (r.income_rmd_p1 ?? 0) > 0)
  const firstP2RMD = rows.find((r) => (r.income_rmd_p2 ?? 0) > 0)
  if (firstP1SS) inflectionYears.add(firstP1SS.year)
  if (firstP2SS) inflectionYears.add(firstP2SS.year)
  if (firstP1RMD) inflectionYears.add(firstP1RMD.year)
  if (firstP2RMD) inflectionYears.add(firstP2RMD.year)
  if (peakRow) inflectionYears.add(peakRow.year)

  const inflectionLabels: Record<number, string[]> = {}
  if (firstP1SS) {
    inflectionLabels[firstP1SS.year] = [
      ...(inflectionLabels[firstP1SS.year] ?? []),
      `SS begins — ${p1}`,
    ]
  }
  if (firstP2SS && p2) {
    inflectionLabels[firstP2SS.year] = [
      ...(inflectionLabels[firstP2SS.year] ?? []),
      `SS begins — ${p2}`,
    ]
  }
  if (firstP1RMD) {
    inflectionLabels[firstP1RMD.year] = [
      ...(inflectionLabels[firstP1RMD.year] ?? []),
      `RMD begins — ${p1}`,
    ]
  }
  if (firstP2RMD && p2) {
    inflectionLabels[firstP2RMD.year] = [
      ...(inflectionLabels[firstP2RMD.year] ?? []),
      `RMD begins — ${p2}`,
    ]
  }
  if (peakRow) {
    inflectionLabels[peakRow.year] = [
      ...(inflectionLabels[peakRow.year] ?? []),
      'Peak net worth',
    ]
  }

  return (
    <div className="mx-auto max-w-[1600px] p-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-[color:var(--mwm-navy)]">Lifetime Snapshot</h1>
          <p className="max-w-xl text-sm text-neutral-600">
            {PLANNING_SURFACES.find((s) => s.id === 'complete')!.description}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {p2 ? `${p1} & ${p2} — year-by-year detail` : `${p1} — year-by-year detail`}
          </p>
        </div>
        <PlanningSurfaceNav className="sm:pt-1" />
      </div>

      {/* ── Hero + stats row ───────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <div
          className={[
            'flex flex-col justify-center rounded-[var(--mwm-radius)] border-2 p-5',
            fundsOutlast ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50',
          ].join(' ')}
        >
          <p
            className={`mb-2 text-xs font-medium uppercase tracking-wider ${fundsOutlast ? 'text-emerald-700' : 'text-red-700'}`}
          >
            Funds outlast lifetime
          </p>
          <p
            className={`mb-2 text-3xl font-medium leading-none ${fundsOutlast ? 'text-emerald-800' : 'text-red-800'}`}
          >
            {fundsOutlast ? 'Yes ✓' : 'No ✗'}
          </p>
          <p className={`text-sm ${fundsOutlast ? 'text-emerald-700' : 'text-red-700'}`}>
            {p2
              ? `${p1} age ${last.age_person1} · ${p2} age ${last.age_person2 ?? '—'} · ${fundsOutlast ? 'On track' : 'Review plan'}`
              : `${p1} age ${last.age_person1} · ${fundsOutlast ? 'On track' : 'Review plan'}`}
          </p>
        </div>

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
          label="Peak net worth"
          value={fmt(peakNetWorth)}
          sub={peakRow ? `Year ${peakRow.year}` : undefined}
        />
        <SummaryCard label="Peak estate value" value={fmt(peakEstate)} sub="Incl. primary home" />
      </div>

      {/* ── Decade timeline ────────────────────────────────────────────────── */}
      <div className="mb-4 flex overflow-hidden rounded-[var(--mwm-radius)] border border-neutral-200">
        {Array.from({ length: totalPages }, (_, i) => {
          const startYear = rows[i * PAGE_SIZE]?.year ?? '—'
          const endRow = rows[Math.min((i + 1) * PAGE_SIZE - 1, rows.length - 1)]
          const endYear = endRow?.year ?? '—'
          const startAge1 = rows[i * PAGE_SIZE]?.age_person1
          const endAge1 = endRow?.age_person1
          return (
            <button
              key={i}
              type="button"
              onClick={() => setActivePage(i)}
              className={[
                'flex-1 border-r border-neutral-200 px-3 py-2 text-center text-xs transition-colors last:border-r-0',
                activePage === i
                  ? 'bg-neutral-100 font-medium text-neutral-800'
                  : 'text-neutral-500 hover:bg-neutral-50',
              ].join(' ')}
            >
              <div>
                {startYear}–{endYear}
              </div>
              <div className="mt-0.5 opacity-60">
                {p1} {startAge1}–{endAge1}
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-amber-400 bg-amber-100" />
          Inflection point
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-neutral-200 bg-neutral-100" />
          Decade boundary
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-emerald-100" />
          Positive cash flow
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-red-100" />
          Negative cash flow
        </span>
      </div>

      {/* ── Column group toggles ────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium text-neutral-400">Expand:</span>
        <GroupToggle
          label={`${p1}`}
          expanded={expandP1}
          onToggle={() => setExpandP1((v) => !v)}
          color="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
        />
        {p2 && (
          <GroupToggle
            label={`${p2}`}
            expanded={expandP2}
            onToggle={() => setExpandP2((v) => !v)}
            color="border-[color:var(--mwm-sage-pale)] bg-[var(--mwm-sage-pale)] text-violet-700 hover:bg-violet-100"
          />
        )}
        <GroupToggle
          label="Tax"
          expanded={expandTax}
          onToggle={() => setExpandTax((v) => !v)}
          color="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
        />
        <GroupToggle
          label="Real Estate"
          expanded={expandRE}
          onToggle={() => setExpandRE((v) => !v)}
          color="border-[color:var(--mwm-sage-pale)] bg-[var(--mwm-sage-pale)] text-[color:var(--mwm-sage)] hover:bg-[var(--mwm-sage-pale)]"
        />
        <GroupToggle
          label="Estate"
          expanded={expandEstate}
          onToggle={() => setExpandEstate((v) => !v)}
          color="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
        />
      </div>

      {/* ── RMD Warning Banner ───────────────────────────────────────────── */}
      {(() => {
        const shortfallRows = rows.filter((r) => (r.rmd_shortfall ?? 0) > 0)
        if (shortfallRows.length === 0) return null
        return (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="mb-1 text-sm font-semibold text-amber-800">
              ⚠ RMD Shortfall Detected in {shortfallRows.length} Year
              {shortfallRows.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-amber-700">
              Your planned withdrawals fall below IRS required minimum distributions in the
              highlighted years below. The IRS imposes a 25% excise tax on shortfall amounts.
              Review the highlighted years and update your planned withdrawals on the Income
              page.
            </p>
          </div>
        )
      })()}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100">
                <th colSpan={leadingColSpan} className="px-3 pb-1 pt-3" />
                <th colSpan={p1ColSpan} className="px-2 pb-1 pt-3 text-center">
                  <span className="inline-block rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    {p1}
                  </span>
                </th>
                {p2 && (
                  <th colSpan={p2ColSpan} className="px-2 pb-1 pt-3 text-center">
                    <span className="inline-block rounded border border-[color:var(--mwm-sage-pale)] bg-[var(--mwm-sage-pale)] px-2 py-0.5 text-xs font-semibold text-violet-700">
                      {p2}
                    </span>
                  </th>
                )}
                <th colSpan={1} className="px-3 pb-1 pt-3" />
                <th colSpan={expandTax ? 7 : 1} className="px-2 pb-1 pt-3 text-center">
                  <span className="inline-block rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    Tax
                  </span>
                </th>
                <th colSpan={2} className="px-3 pb-1 pt-3" />
                <th colSpan={expandRE ? 3 : 1} className="px-2 pb-1 pt-3 text-center">
                  <span className="inline-block rounded border border-[color:var(--mwm-sage-pale)] bg-[var(--mwm-sage-pale)] px-2 py-0.5 text-xs font-semibold text-[color:var(--mwm-sage)]">
                    Real Estate
                  </span>
                </th>
                <th colSpan={expandEstate ? 2 : 1} className="px-2 pb-1 pt-3 text-center">
                  <span className="inline-block rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                    Estate
                  </span>
                </th>
                <th className="px-3 pb-1 pt-3" />
              </tr>

              <tr className="border-b border-neutral-200 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                <th className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2">Year</th>
                <th className="whitespace-nowrap px-2 py-2">{p1} Age</th>
                {p2 && <th className="whitespace-nowrap px-2 py-2">{p2} Age</th>}
                <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
                  Trend
                </th>

                <th className="whitespace-nowrap px-2 py-2 text-blue-600">Income</th>
                {anyP1SSOnPage && (
                  <th className="whitespace-nowrap px-2 py-2 text-blue-500">SS</th>
                )}
                {anyP1RMDOnPage && (
                  <th className="whitespace-nowrap px-2 py-2 text-blue-500">RMD</th>
                )}
                {expandP1 && (
                  <>
                    <th className="whitespace-nowrap px-2 py-2 text-blue-500">Earned</th>
                    <th className="whitespace-nowrap px-2 py-2 text-blue-500">Other</th>
                    <th className="whitespace-nowrap px-2 py-2 text-blue-500">Assets</th>
                  </>
                )}

                {p2 && (
                  <>
                    <th className="whitespace-nowrap px-2 py-2 text-violet-600">Income</th>
                    {anyP2SSOnPage && (
                      <th className="whitespace-nowrap px-2 py-2 text-[color:var(--mwm-sage)]">SS</th>
                    )}
                    {anyP2RMDOnPage && (
                      <th className="whitespace-nowrap px-2 py-2 text-[color:var(--mwm-sage)]">
                        RMD
                      </th>
                    )}
                    {expandP2 && (
                      <>
                        <th className="whitespace-nowrap px-2 py-2 text-[color:var(--mwm-sage)]">
                          Earned
                        </th>
                        <th className="whitespace-nowrap px-2 py-2 text-[color:var(--mwm-sage)]">
                          Other
                        </th>
                        <th className="whitespace-nowrap px-2 py-2 text-[color:var(--mwm-sage)]">
                          Assets
                        </th>
                      </>
                    )}
                  </>
                )}

                <th className="whitespace-nowrap px-2 py-2">Total Income</th>

                <th className="whitespace-nowrap px-2 py-2 text-amber-600">Tax Total</th>
                {expandTax && (
                  <>
                    <th className="whitespace-nowrap px-2 py-2 text-amber-500">Federal</th>
                    <th className="whitespace-nowrap px-2 py-2 text-amber-500">State</th>
                    <th className="whitespace-nowrap px-2 py-2 text-amber-500">Cap Gains</th>
                    <th className="whitespace-nowrap px-2 py-2 text-amber-500">NIIT</th>
                    <th className="whitespace-nowrap px-2 py-2 text-amber-500">Payroll</th>
                    <th className="whitespace-nowrap px-2 py-2 text-amber-500">IRMAA</th>
                  </>
                )}

                <th className="whitespace-nowrap px-2 py-2">Expenses</th>
                <th className="whitespace-nowrap px-2 py-2">Net CF</th>

                <th className="whitespace-nowrap px-2 py-2 text-[color:var(--mwm-sage)]">RE Total</th>
                {expandRE && (
                  <>
                    <th className="whitespace-nowrap px-2 py-2 text-[color:var(--mwm-sage)]">
                      Primary
                    </th>
                    <th className="whitespace-nowrap px-2 py-2 text-[color:var(--mwm-sage)]">
                      Other RE
                    </th>
                  </>
                )}

                <th className="whitespace-nowrap px-2 py-2 text-rose-600">Incl. Home</th>
                {expandEstate && (
                  <th className="whitespace-nowrap px-2 py-2 text-rose-500">Excl. Home</th>
                )}

                <th className="whitespace-nowrap px-3 py-2">Net Worth</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-100">
              {visibleRows.map((r, i) => {
                const pooledOther = r.income_other_pooled ?? 0
                const pooledSplit = hasSpouse ? Math.round(pooledOther / 2) : pooledOther
                const p1Income =
                  (r.income_earned_p1 ?? 0) +
                  r.income_ss_person1 +
                  (r.income_rmd_p1 ?? 0) +
                  (r.income_other_p1 ?? 0) +
                  (hasSpouse ? pooledSplit : pooledOther)
                const p2Income = hasSpouse
                  ? (r.income_earned_p2 ?? 0) +
                    r.income_ss_person2 +
                    (r.income_rmd_p2 ?? 0) +
                    (r.income_other_p2 ?? 0) +
                    pooledSplit
                  : 0
                const p1Assets = r.assets_p1_total ?? 0
                const p2Assets = r.assets_p2_total ?? 0
                const irmaaTotal = (r.irmaa_part_b ?? 0) + (r.irmaa_part_d ?? 0)
                const reTotal = r.real_estate_total ?? 0
                const combinedIncome = p1Income + p2Income
                const surface = rowSurface(r, i, inflectionYears)

                return (
                  <tr key={r.year} className={`text-neutral-700 ${surface.tr}`}>
                    <td
                      className={`sticky left-0 z-10 whitespace-nowrap px-3 py-2 font-medium text-neutral-900 ${surface.sticky}`}
                    >
                      {r.year}
                      {inflectionLabels[r.year]?.map((label) => (
                        <span
                          key={label}
                          className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                        >
                          {label}
                        </span>
                      ))}
                    </td>
                    <td className="px-2 py-2 text-neutral-500">{r.age_person1}</td>
                    {p2 && <td className="px-2 py-2 text-neutral-500">{r.age_person2 ?? '—'}</td>}
                    <td className="px-2 py-2">
                      <Sparkline value={r.net_worth ?? 0} max={maxNetWorth} min={minNetWorth} />
                    </td>

                    <td className="px-2 py-2 font-medium text-blue-700">{fmt(p1Income)}</td>
                    {anyP1SSOnPage && (
                      <td className="px-2 py-2 text-blue-600">{fmt(r.income_ss_person1)}</td>
                    )}
                    {anyP1RMDOnPage && (
                      <td className="px-2 py-2 text-blue-600">{fmt(r.income_rmd_p1 ?? 0)}</td>
                    )}
                    {expandP1 && (
                      <>
                        <td className="px-2 py-2 text-blue-600">{fmt(r.income_earned_p1 ?? 0)}</td>
                        <td className="px-2 py-2 text-blue-600">{fmt(r.income_other_p1 ?? 0)}</td>
                        <td className="px-2 py-2 text-blue-600">{fmt(p1Assets)}</td>
                      </>
                    )}

                    {p2 && (
                      <>
                        <td className="px-2 py-2 font-medium text-violet-700">{fmt(p2Income)}</td>
                        {anyP2SSOnPage && (
                          <td className="px-2 py-2 text-violet-600">{fmt(r.income_ss_person2)}</td>
                        )}
                        {anyP2RMDOnPage && (
                          <td className="px-2 py-2 text-violet-600">{fmt(r.income_rmd_p2 ?? 0)}</td>
                        )}
                        {expandP2 && (
                          <>
                            <td className="px-2 py-2 text-violet-600">
                              {fmt(r.income_earned_p2 ?? 0)}
                            </td>
                            <td className="px-2 py-2 text-violet-600">
                              {fmt(r.income_other_p2 ?? 0)}
                            </td>
                            <td className="px-2 py-2 text-violet-600">{fmt(p2Assets)}</td>
                          </>
                        )}
                      </>
                    )}

                    <td className="px-2 py-2 font-semibold text-neutral-900">
                      {fmt(combinedIncome)}
                    </td>

                    <td className="px-2 py-2 font-medium text-amber-700">{fmt(r.tax_total)}</td>
                    {expandTax && (
                      <>
                        <td className="px-2 py-2 text-amber-600">{fmt(r.tax_federal)}</td>
                        <td className="px-2 py-2 text-amber-600">{fmt(r.tax_state)}</td>
                        <td className="px-2 py-2 text-amber-600">{fmt(r.tax_capital_gains)}</td>
                        <td className="px-2 py-2 text-amber-600">{fmt(r.tax_niit)}</td>
                        <td className="px-2 py-2 text-amber-600">{fmt(r.tax_payroll)}</td>
                        <td className="px-2 py-2 text-amber-600">{fmt(irmaaTotal)}</td>
                      </>
                    )}

                    <td className="px-2 py-2 text-red-500">{fmt(r.expenses_total)}</td>
                    <td
                      className={[
                        'px-2 py-2 text-right tabular-nums font-semibold',
                        r.net_cash_flow >= 0 ? 'text-emerald-700' : 'text-red-600',
                      ].join(' ')}
                    >
                      {r.net_cash_flow >= 0 ? '+' : ''}
                      {fmt(r.net_cash_flow)}
                    </td>

                    <td className="px-2 py-2 font-medium text-[color:var(--mwm-sage)]">
                      {fmt(reTotal)}
                    </td>
                    {expandRE && (
                      <>
                        <td className="px-2 py-2 text-[color:var(--mwm-sage)]">
                          {fmt(r.real_estate_primary ?? 0)}
                        </td>
                        <td className="px-2 py-2 text-[color:var(--mwm-sage)]">
                          {fmt(r.real_estate_other ?? 0)}
                        </td>
                      </>
                    )}

                    <td className="px-2 py-2 font-medium text-rose-700">
                      {fmt(r.estate_incl_home ?? 0)}
                    </td>
                    {expandEstate && (
                      <td className="px-2 py-2 text-rose-600">{fmt(r.estate_excl_home ?? 0)}</td>
                    )}

                    <td
                      className={`px-3 py-2 font-bold ${(r.net_worth ?? 0) < 1000 ? 'text-red-600' : 'text-neutral-900'}`}
                    >
                      {fmt(r.net_worth)}
                      {(r.rmd_shortfall ?? 0) > 0 && (
                        <span
                          className="ml-1 cursor-help text-xs text-amber-600"
                          title={`RMD required: ${fmt(r.rmd_required ?? 0)} · Planned: ${fmt(r.rmd_user_withdrawal ?? 0)} · Shortfall: ${fmt(r.rmd_shortfall ?? 0)} · Est. IRS penalty: ${fmt(r.rmd_penalty ?? 0)}`}
                        >
                          ⚠
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-neutral-200 px-4 py-3">
          <p className="text-xs text-neutral-400">
            Years {rows[pageStart]?.year}–
            {rows[Math.min(pageStart + PAGE_SIZE - 1, rows.length - 1)]?.year} · Page{' '}
            {activePage + 1} of {totalPages}
          </p>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-neutral-400">
        Values shown are end-of-year projections — year 1 reflects today&apos;s balances after
        income, expenses, and growth are applied for the full year. Financial assets grow at your
        portfolio rate (Scenarios) · Real estate appreciates at your configured rate · Business
        interests use your business growth rate · Click group labels above to expand detail columns
      </p>
    </div>
  )
}
