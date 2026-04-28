'use client'

// ─────────────────────────────────────────
// Menu: Financial Planning > Projections
// Route: /projections
// ─────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { displayPersonFirstName } from '@/lib/display-person-name'

type ProjectionYear = {
  age: number
  year: number
  income: number
  expenses: number
  taxes: number
  net: number
  portfolio: number
  net_worth: number
  phase: 'accumulation' | 'retirement'
  // per-person
  income_ss_person1: number
  income_ss_person2: number
  income_rmd_p1: number
  income_rmd_p2: number
  income_earned_p1: number
  income_earned_p2: number
  income_other_p1: number
  income_other_p2: number
  income_other_pooled: number
  age_person1: number
  age_person2: number | null
}

type Household = {
  id: string
  person1_name: string
  person1_birth_year: number
  person1_retirement_age: number
  person1_longevity_age: number
  person2_name: string | null
  person2_birth_year: number | null
  has_spouse: boolean
  inflation_rate: number
  growth_rate_accumulation: number
  growth_rate_retirement: number
  state_primary: string
  filing_status: string
  deduction_mode: 'standard' | 'custom' | 'none'
  custom_deduction_amount: number
}

type ProjectionApiRow = {
  year: number
  age_person1: number
  age_person2?: number | null
  income_total: number
  expenses_total: number
  tax_total: number
  assets_p1_total?: number | null
  assets_p2_total?: number | null
  assets_pooled_total?: number | null
  net_worth?: number | null
  income_ss_person1?: number | null
  income_ss_person2?: number | null
  income_rmd_p1?: number | null
  income_rmd_p2?: number | null
  income_earned_p1?: number | null
  income_earned_p2?: number | null
  income_other_p1?: number | null
  income_other_p2?: number | null
  income_other_pooled?: number | null
}

export default function ProjectionsPage() {
  const [household, setHousehold] = useState<Household | null>(null)
  const [projections, setProjections] = useState<ProjectionYear[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'chart' | 'table' | 'income'>('chart')

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/projection', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load projection data')
      const { rows, household } = await res.json()
      if (!household) throw new Error('No household found')
      setHousehold(household)
      // Map YearRow to ProjectionYear
      const mapped: ProjectionYear[] = (rows as ProjectionApiRow[]).map((r) => ({
        age: r.age_person1,
        year: r.year,
        income: r.income_total,
        expenses: r.expenses_total,
        taxes: r.tax_total,
        net: r.income_total - r.expenses_total - r.tax_total,
        portfolio: (r.assets_p1_total ?? 0) + (r.assets_p2_total ?? 0) + (r.assets_pooled_total ?? 0),
        net_worth: r.net_worth ?? 0,
        phase: r.age_person1 >= (household.person1_retirement_age ?? 65) ? 'retirement' : 'accumulation',
        income_ss_person1: r.income_ss_person1 ?? 0,
        income_ss_person2: r.income_ss_person2 ?? 0,
        income_rmd_p1: r.income_rmd_p1 ?? 0,
        income_rmd_p2: r.income_rmd_p2 ?? 0,
        income_earned_p1: r.income_earned_p1 ?? 0,
        income_earned_p2: r.income_earned_p2 ?? 0,
        income_other_p1: r.income_other_p1 ?? 0,
        income_other_p2: r.income_other_p2 ?? 0,
        income_other_pooled: r.income_other_pooled ?? 0,
        age_person1: r.age_person1,
        age_person2: r.age_person2 ?? null,
      }))
      setProjections(mapped)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-neutral-500">Loading...</p></div>
  }

  if (!household) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <div className="text-4xl mb-3">📈</div>
          <p className="text-sm font-medium text-neutral-600">Complete your profile first</p>
          <Link href="/profile" className="mt-3 text-sm text-indigo-600 hover:underline">Go to Profile →</Link>
        </div>
      </div>
    )
  }

  if (projections.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <div className="text-4xl mb-3">📈</div>
          <p className="text-sm font-medium text-neutral-600">No projection data yet</p>
          <p className="mt-1 text-xs text-neutral-500">
            Complete profile, income, and assets, then run your estate plan to generate projections.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Link href="/profile" className="text-sm text-indigo-600 hover:underline">
              Complete profile →
            </Link>
            <Link href="/my-estate-strategy" className="text-sm text-indigo-600 hover:underline">
              Generate estate plan →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const retirementRow = projections.find(p => p.phase === 'retirement')
  const finalRow = projections[projections.length - 1]
  const peakNetWorth = projections.length > 0 ? Math.max(...projections.map(p => p.net_worth)) : 0
  const fundsOutlast = (finalRow?.portfolio ?? 0) > 0
  const retirementRows = projections.filter(p => p.phase === 'retirement')
  const avgRetirementTax = retirementRows.length > 0
    ? Math.round(retirementRows.reduce((s, r) => s + r.taxes, 0) / retirementRows.length)
    : 0
  const p1 = displayPersonFirstName(household.person1_name, 'Person 1')
  const p2 = household.has_spouse ? displayPersonFirstName(household.person2_name, 'Person 2') : null

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Projections</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Based on your current income, expenses, assets, and tax settings from your profile.
          </p>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      {/* Growth assumptions (read-only from profile) */}
      <div className="mb-6 rounded-xl border border-neutral-200 bg-white shadow-sm p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Projection Assumptions</h2>
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <p className="mb-1 block text-xs font-medium text-neutral-500">Accumulation Growth Rate</p>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700">
              {(household.growth_rate_accumulation ?? 7).toFixed(1)}%
            </div>
          </div>
          <div>
            <p className="mb-1 block text-xs font-medium text-neutral-500">Retirement Growth Rate</p>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700">
              {(household.growth_rate_retirement ?? 5).toFixed(1)}%
            </div>
          </div>
          <p className="pb-2 text-xs text-neutral-500">
            This projection is based on growth assumptions from your profile.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="Net Worth at Retirement"
          value={formatDollars(retirementRow?.net_worth ?? 0)}
          sub={`Age ${household.person1_retirement_age} · includes RE & business`}
        />
        <SummaryCard
          label="Financial Portfolio at Retirement"
          value={formatDollars(retirementRow?.portfolio ?? 0)}
          sub={`Age ${household.person1_retirement_age} · investable assets only`}
        />
        <SummaryCard label="Avg Tax in Retirement" value={formatDollars(avgRetirementTax)} sub="Federal + state/yr" highlight="amber" />
        <SummaryCard label="Funds Outlast" value={fundsOutlast ? 'Yes ✓' : 'No ✗'} sub={fundsOutlast ? 'On track' : 'Review plan'} highlight={fundsOutlast ? 'green' : 'red'} />
      </div>

      {/* Chart / Table / Income tabs */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm">
        <div className="flex border-bder-neutral-200 px-4 pt-4 gap-1">
          {(['chart', 'table', 'income'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg capitalize transition-colors ${
                activeTab === tab ? 'border-b-2 border-neutral-900 text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'
              }`}>
              {tab === 'income' ? 'Income Detail' : tab}
            </button>
          ))}
        </div>
        <div className="p-4">
          {activeTab === 'chart' && <BarChart projections={projections} peak={peakNetWorth} />}
          {activeTab === 'table' && <ProjectionTable projections={projections} />}
          {activeTab === 'income' && <IncomeTable projections={projections} p1={p1} p2={p2} />}
        </div>
      </div>

      <p className="mt-4 text-xs text-neutral-400">
        * Projection tax estimates include federal income tax, state income tax, capital gains tax,
        NIIT, payroll tax, and IRMAA surcharges. Federal tax uses filing status and your selected
        deduction mode; state income tax uses progressive state bracket tables by filing status and year.
      </p>
    </div>
  )
}

function SummaryCard({ label, value, sub, highlight }: {
  label: string; value: string; sub: string; highlight?: 'green' | 'red' | 'amber'
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${
        highlight === 'green' ? 'text-green-600' :
        highlight === 'red' ? 'text-red-600' :
        highlight === 'amber' ? 'text-amber-600' :
        'text-neutral-900'
      }`}>{value}</p>
      <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>
    </div>
  )
}

function BarChart({ projections, peak }: { projections: ProjectionYear[]; peak: number }) {
  const step = projections.length > 40 ? 5 : projections.length > 25 ? 2 : 1
  const sampled = projections.filter((_, i) => i % step === 0)
  return (
    <div className="flex items-end gap-0.5 h-56 w-full px-2">
      {sampled.map((p) => {
        const pct = peak > 0 ? (p.net_worth / peak) * 100 : 0
        return (
          <div key={p.age} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="relative w-full flex items-end" style={{ height: '200px' }}>
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 hidden group-hover:block whitespace-nowrap rounded-lg bg-neutral-900 px-2 py-1 text-xs text-white shadow-lg">
                Age {p.age}: {formatDollars(p.net_worth)}
              </div>
              <div className={`w-full rounded-t transition-all ${
                p.phase === 'retirement'
                  ? p.net_worth < peak * 0.1 ? 'bg-red-400' : 'bg-orange-400'
                  : 'bg-neutral-700'
              }`} style={{ height: `${Math.max(pct, 1)}%` }} />
            </div>
            <span className="text-[10px] text-neutral-400">{p.age}</span>
          </div>
        )
      })}
    </div>
  )
}

function ProjectionTable({ projections }: { projections: ProjectionYear[] }) {
  return (
    <div className="overflow-auto max-h-96">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <th className="pb-2 pr-4">Age</th>
            <th className="pb-2 pr-4">Year</th>
            <th className="pb-2 pr-4">Income</th>
            <th className="pb-2 pr-4">Expenses</th>
            <th className="pb-2 pr-4">Taxes</th>
            <th className="pb-2 pr-4">Net</th>
            <th className="pb-2 pr-4">Portfolio</th>
            <th className="pb-2">Net Worth</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {projections.map((p) => (
            <tr key={p.age} className={p.phase === 'retirement' ? 'bg-orange-50/50' : ''}>
              <td className="py-1.5 pr-4 font-medium text-neutral-800">{p.age}</td>
              <td className="py-1.5 pr-4 text-neutral-500">{p.year}</td>
              <td className="py-1.5 pr-4 text-green-600">{formatDollars(p.income)}</td>
              <td className="py-1.5 pr-4 text-red-500">{formatDollars(p.expenses)}</td>
              <td className="py-1.5 pr-4 text-amber-600">{formatDollars(p.taxes)}</td>
              <td className={`py-1.5 pr-4 font-medium ${p.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {p.net >= 0 ? '+' : ''}{formatDollars(p.net)}
              </td>
              <td className={`py-1.5 pr-4 font-semibold ${p.portfolio < 1000 ? 'text-red-600' : 'text-neutral-900'}`}>
                {formatDollars(p.portfolio)}
              </td>
              <td className={`py-1.5 font-semibold ${p.net_worth < 1000 ? 'text-red-600' : 'text-indigo-700'}`}>
                {formatDollars(p.net_worth)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IncomeTable({ projections, p1, p2 }: { projections: ProjectionYear[]; p1: string; p2: string | null }) {
  return (
    <div className="overflow-auto max-h-96">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <th className="pb-2 pr-4">Age</th>
            <th className="pb-2 pr-4">Year</th>
            <th className="pb-2 pr-3 text-blue-600">{p1} Earned</th>
            <th className="pb-2 pr-3 text-blue-600">{p1} SS</th>
            <th className="pb-2 pr-3 text-blue-600">{p1} RMD</th>
            <th className="pb-2 pr-3 text-blue-600">{p1} Other</th>
            {p2 && <>
              <th className="pb-2 pr-3 text-violet-600">{p2} Earned</th>
              <th className="pb-2 pr-3 text-violet-600">{p2} SS</th>
              <th className="pb-2 pr-3 text-violet-600">{p2} RMD</th>
              <th className="pb-2 pr-3 text-violet-600">{p2} Other</th>
            </>}
            <th className="pb-2 pr-4">Joint/Other</th>
            <th className="pb-2">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {projections.map((p) => (
            <tr key={p.age} className={p.phase === 'retirement' ? 'bg-orange-50/50' : ''}>
              <td className="py-1.5 pr-4 font-medium text-neutral-800">{p.age}</td>
              <td className="py-1.5 pr-4 text-neutral-500">{p.year}</td>
              <td className="py-1.5 pr-3 text-blue-700">{formatDollars(p.income_earned_p1)}</td>
              <td className="py-1.5 pr-3 text-blue-700">{formatDollars(p.income_ss_person1)}</td>
              <td className="py-1.5 pr-3 text-blue-700">{formatDollars(p.income_rmd_p1)}</td>
              <td className="py-1.5 pr-3 text-blue-700">{formatDollars(p.income_other_p1)}</td>
              {p2 && <>
                <td className="py-1.5 pr-3 text-violet-700">{formatDollars(p.income_earned_p2)}</td>
                <td className="py-1.5 pr-3 text-violet-700">{formatDollars(p.income_ss_person2)}</td>
                <td className="py-1.5 pr-3 text-violet-700">{formatDollars(p.income_rmd_p2)}</td>
                <td className="py-1.5 pr-3 text-violet-700">{formatDollars(p.income_other_p2)}</td>
              </>}
              <td className="py-1.5 pr-4 text-neutral-500">{formatDollars(p.income_other_pooled)}</td>
              <td className="py-1.5 font-semibold text-green-600">{formatDollars(p.income)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatDollars(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}
