'use client'

// ─────────────────────────────────────────
// Menu: Retirement Planning > RMD Calculator
// Route: /rmd
// ─────────────────────────────────────────

import { useState, useEffect, Fragment } from 'react'
import Link from 'next/link'
import { displayPersonFirstName } from '@/lib/display-person-name'

type Household = {
  id: string
  person1_name: string
  person1_birth_year: number
  person1_longevity_age: number | null
  person1_retirement_age: number | null
  has_spouse: boolean
  person2_name: string | null
  person2_birth_year: number | null
  person2_longevity_age: number | null
  person2_retirement_age: number | null
  filing_status: string
  growth_rate_retirement: number | null
}

type Asset = {
  id: string
  name: string
  type: string
  value: number
  owner: string | null
}

type RmdAccountResult = {
  asset_id: string
  asset_name: string
  asset_type: string
  prior_year_balance: number
  owner_age: number
  life_expectancy_factor: number
  rmd_amount: number
  notes: string[]
}

type RmdYearRow = {
  year: number
  p1_age: number | null
  p2_age: number | null
  p1_rmd: number
  p2_rmd: number
  total_rmd: number
  p1_accounts: RmdAccountResult[]
  p2_accounts: RmdAccountResult[]
  is_first_year_p1: boolean
  is_first_year_p2: boolean
}

const ROWS_PER_PAGE = 10

const uniformFactors: Record<number, number> = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
  78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
  84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
  90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
  96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4,
}

function rmdStartAge(birthYear: number): number {
  if (birthYear >= 1960) return 75
  if (birthYear >= 1951) return 73
  return 72
}

function formatDollars(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function computePersonRmds(
  birthYear: number,
  longevityAge: number,
  growthRate: number,
  assets: Asset[]
): Map<number, { rmd: number; accounts: RmdAccountResult[]; isFirstYear: boolean }> {
  const currentYear = new Date().getFullYear()
  const startAge = currentYear - birthYear
  const startRmdAge = rmdStartAge(birthYear)
  const results = new Map<number, { rmd: number; accounts: RmdAccountResult[]; isFirstYear: boolean }>()
  const eligible = assets.filter(a => ['traditional_ira', 'traditional_401k'].includes(a.type))
  if (eligible.length === 0) return results
  const balances: Record<string, number> = {}
  for (const a of eligible) balances[a.id] = Number(a.value)
  for (let age = startAge; age <= longevityAge; age++) {
    const year = currentYear + (age - startAge)
    const isFirstYear = age === startRmdAge
    if (age < startRmdAge) {
      for (const a of eligible) balances[a.id] = Math.round(balances[a.id] * (1 + growthRate) * 100) / 100
      continue
    }
    const factor = uniformFactors[Math.min(age, 100)] ?? 2.0
    const accountResults: RmdAccountResult[] = []
    let totalRmd = 0
    for (const a of eligible.filter(a => a.type === 'traditional_401k')) {
      const bal = balances[a.id] ?? 0
      const rmd = Math.round((bal / factor) * 100) / 100
      accountResults.push({ asset_id: a.id, asset_name: a.name, asset_type: a.type, prior_year_balance: bal, owner_age: age, life_expectancy_factor: factor, rmd_amount: rmd, notes: isFirstYear ? ['First RMD year — deferral to Apr 1 available'] : [] })
      totalRmd += rmd
    }
    const iras = eligible.filter(a => a.type === 'traditional_ira')
    if (iras.length > 0) {
      const totalIraBal = iras.reduce((s, a) => s + (balances[a.id] ?? 0), 0)
      const totalIraRmd = Math.round((totalIraBal / factor) * 100) / 100
      const perIra = Math.round((totalIraRmd / iras.length) * 100) / 100
      for (const a of iras) {
        accountResults.push({ asset_id: a.id, asset_name: a.name, asset_type: a.type, prior_year_balance: balances[a.id] ?? 0, owner_age: age, life_expectancy_factor: factor, rmd_amount: perIra, notes: [`IRA aggregation — total IRA RMD: ${formatDollars(totalIraRmd)}`, ...(isFirstYear ? ['First RMD year — deferral to Apr 1 available'] : [])] })
      }
      totalRmd += totalIraRmd
    }
    results.set(year, { rmd: Math.round(totalRmd * 100) / 100, accounts: accountResults, isFirstYear })
    for (const a of eligible) {
      const rmdTaken = accountResults.find(r => r.asset_id === a.id)?.rmd_amount ?? 0
      balances[a.id] = Math.max(0, Math.round((balances[a.id] * (1 + growthRate) - rmdTaken) * 100) / 100)
    }
  }
  return results
}

export function RmdClient({ household, assets }: { household: Household | null; assets: Asset[] }) {
  const [rows, setRows] = useState<RmdYearRow[]>([])
  const [expandedYear, setExpandedYear] = useState<number | null>(null)
  const [periodOffset, setPeriodOffset] = useState(0)

  useEffect(() => {
    if (!household) return
    const growthRate = (household.growth_rate_retirement ?? 5) / 100
    const p1Name = displayPersonFirstName(household.person1_name, 'Person 1')
    const p2Name = household.has_spouse ? displayPersonFirstName(household.person2_name, 'Person 2') : null
    const p1Assets = assets.filter(a => { const o = a.owner?.trim().toLowerCase() ?? ''; return o === 'person1' || o === p1Name.toLowerCase() || o === household.person1_name?.trim().toLowerCase() })
    const p2Assets = household.has_spouse ? assets.filter(a => { const o = a.owner?.trim().toLowerCase() ?? ''; return o === 'person2' || o === p2Name?.toLowerCase() || o === household.person2_name?.trim().toLowerCase() }) : []
    const pooledAssets = assets.filter(a => !p1Assets.includes(a) && !p2Assets.includes(a))
    const p1Longevity = household.person1_longevity_age ?? 90
    const p2Longevity = household.person2_longevity_age ?? 90
    const p1Map = computePersonRmds(household.person1_birth_year, p1Longevity, growthRate, [...p1Assets, ...pooledAssets])
    const p2Map = household.has_spouse && household.person2_birth_year ? computePersonRmds(household.person2_birth_year, p2Longevity, growthRate, p2Assets) : new Map()
    const allYears = new Set([...p1Map.keys(), ...p2Map.keys()])
    const combined: RmdYearRow[] = Array.from(allYears).sort().map(year => {
      const p1 = p1Map.get(year); const p2 = p2Map.get(year)
      return { year, p1_age: household.person1_birth_year ? year - household.person1_birth_year : null, p2_age: household.person2_birth_year ? year - household.person2_birth_year : null, p1_rmd: p1?.rmd ?? 0, p2_rmd: p2?.rmd ?? 0, total_rmd: (p1?.rmd ?? 0) + (p2?.rmd ?? 0), p1_accounts: p1?.accounts ?? [], p2_accounts: p2?.accounts ?? [], is_first_year_p1: p1?.isFirstYear ?? false, is_first_year_p2: p2?.isFirstYear ?? false }
    })
    const timeoutId = window.setTimeout(() => {
      setRows(combined)
      // Reset to first page when data reloads — find page that contains current year
      const currentYear = new Date().getFullYear()
      const currentYearIdx = combined.findIndex(r => r.year === currentYear)
      if (currentYearIdx >= 0) {
        setPeriodOffset(Math.floor(currentYearIdx / ROWS_PER_PAGE))
      } else {
        setPeriodOffset(0)
      }
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [household, assets])

  if (!household) return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
        <div className="text-4xl mb-3">📋</div>
        <p className="text-sm font-medium text-neutral-600">Complete your profile first</p>
        <Link href="/profile" className="mt-3 text-sm text-indigo-600 hover:underline">Go to Profile →</Link>
      </div>
    </div>
  )

  if (assets.length === 0) return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8"><h1 className="text-2xl font-bold text-neutral-900">RMD Calculator</h1></div>
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
        <div className="text-4xl mb-3">🏦</div>
        <p className="text-sm font-medium text-neutral-600">No RMD-eligible accounts found</p>
        <p className="text-xs text-neutral-400 mt-1">Add a Traditional IRA or Traditional 401(k) to your assets</p>
        <Link href="/assets" className="mt-3 text-sm text-indigo-600 hover:underline">Go to Assets →</Link>
      </div>
    </div>
  )

  const currentYear = new Date().getFullYear()
  const p1Name = displayPersonFirstName(household.person1_name, 'Person 1')
  const p2Name = household.has_spouse ? displayPersonFirstName(household.person2_name, 'Person 2') : null
  const p1StartAge = rmdStartAge(household.person1_birth_year)
  const p2StartAge = household.person2_birth_year ? rmdStartAge(household.person2_birth_year) : null
  const currentRow = rows.find(r => r.year === currentYear)
  const p1TotalLifetime = rows.reduce((s, r) => s + r.p1_rmd, 0)
  const p2TotalLifetime = rows.reduce((s, r) => s + r.p2_rmd, 0)
  const peakTotal = rows.length > 0 ? Math.max(...rows.map(r => r.total_rmd)) : 0
  const p1Assets = assets.filter(a => { const o = a.owner?.trim().toLowerCase() ?? ''; return o === 'person1' || o === p1Name.toLowerCase() || o === household.person1_name?.trim().toLowerCase() })
  const p2Assets = household.has_spouse ? assets.filter(a => { const o = a.owner?.trim().toLowerCase() ?? ''; return o === 'person2' || o === p2Name?.toLowerCase() || o === household.person2_name?.trim().toLowerCase() }) : []
  const pooledAssets = assets.filter(a => !p1Assets.includes(a) && !p2Assets.includes(a))

  // Pagination
  const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE)
  const visibleRows = rows.slice(periodOffset * ROWS_PER_PAGE, (periodOffset + 1) * ROWS_PER_PAGE)
  const periodStartYear = visibleRows[0]?.year ?? currentYear
  const periodEndYear = visibleRows[visibleRows.length - 1]?.year ?? currentYear

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">RMD Calculator</h1>
        <p className="mt-1 text-sm text-neutral-600">Required Minimum Distributions using IRS Uniform Lifetime Table (2022 regulations, SECURE Act 2.0).</p>
      </div>

      <div className={`grid grid-cols-2 ${household.has_spouse ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-4 mb-4`}>
        <SummaryCard label={`${p1Name} RMD Start`} value={String(p1StartAge)} sub={household.person1_birth_year >= 1960 ? 'Born 1960+ (SECURE 2.0)' : 'Born 1951-1959'} color="blue" />
        <SummaryCard label={`${p1Name} ${currentYear} RMD`} value={currentRow ? formatDollars(currentRow.p1_rmd) : 'Not yet required'} sub={currentRow?.p1_age ? `Age ${currentRow.p1_age}` : ''} highlight={currentRow && currentRow.p1_rmd > 0 ? 'amber' : undefined} color="blue" />
        {household.has_spouse && p2Name && p2StartAge && <>
          <SummaryCard label={`${p2Name} RMD Start`} value={String(p2StartAge)} sub={household.person2_birth_year && household.person2_birth_year >= 1960 ? 'Born 1960+ (SECURE 2.0)' : 'Born 1951-1959'} color="violet" />
          <SummaryCard label={`${p2Name} ${currentYear} RMD`} value={currentRow ? formatDollars(currentRow.p2_rmd) : 'Not yet required'} sub={currentRow?.p2_age ? `Age ${currentRow.p2_age}` : ''} highlight={currentRow && currentRow.p2_rmd > 0 ? 'amber' : undefined} color="violet" />
        </>}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <SummaryCard label="Peak Annual RMD" value={peakTotal > 0 ? formatDollars(peakTotal) : '—'} sub="Highest single-year combined" />
        <SummaryCard label="Lifetime RMDs" value={formatDollars(p1TotalLifetime + p2TotalLifetime)} sub={`${p1Name}: ${formatDollars(p1TotalLifetime)}${p2Name ? ' · ' + p2Name + ': ' + formatDollars(p2TotalLifetime) : ''}`} />
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-3">RMD-Eligible Accounts</h2>
        <div className="space-y-4">
          {[
            { name: p1Name, accts: p1Assets, color: 'border-blue-200 bg-blue-50/30' },
            ...(household.has_spouse && p2Name ? [{ name: p2Name, accts: p2Assets, color: 'border-violet-200 bg-violet-50/30' }] : []),
            ...(pooledAssets.length > 0 ? [{ name: 'Joint / Unassigned', accts: pooledAssets, color: 'border-neutral-200 bg-white' }] : []),
          ].map(group => group.accts.length > 0 && (
            <div key={group.name}>
              <p className="text-xs font-semibold text-neutral-500 mb-2">{group.name}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.accts.map(a => (
                  <div key={a.id} className={`rounded-xl border px-4 py-3 flex items-center justify-between ${group.color}`}>
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{a.name}</p>
                      <p className="text-xs text-neutral-400 mt-0.5 capitalize">{a.type.replace(/_/g, ' ')}</p>
                    </div>
                    <p className="text-sm font-semibold text-neutral-900">{formatDollars(Number(a.value))}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Year-by-Year RMD Projection</h2>
            <p className="text-xs text-neutral-400 mt-0.5">Click a row to see per-account breakdown</p>
          </div>
          {/* Period label */}
          <span className="text-sm text-neutral-500 font-medium">
            {periodStartYear} – {periodEndYear}
          </span>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-neutral-100">
            <thead className="bg-neutral-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Year</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-blue-500">{p1Name} Age</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-blue-500">{p1Name} RMD</th>
                {p2Name && <>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-violet-500">{p2Name} Age</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-violet-500">{p2Name} RMD</th>
                </>}
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Total RMD</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {visibleRows.map(r => (
                <Fragment key={r.year}>
                  <tr onClick={() => setExpandedYear(expandedYear === r.year ? null : r.year)} className={`cursor-pointer hover:bg-neutral-50 transition-colors ${r.year === currentYear ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-4 py-3 text-sm font-medium text-neutral-900">
                      {r.year}
                      {r.year === currentYear && <span className="ml-2 text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">Now</span>}
                      {r.is_first_year_p1 && <span className="ml-2 text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">{p1Name} 1st</span>}
                      {r.is_first_year_p2 && <span className="ml-2 text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-0.5">{p2Name} 1st</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-blue-600">{r.p1_age ?? '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-blue-700">{r.p1_rmd > 0 ? formatDollars(r.p1_rmd) : '—'}</td>
                    {p2Name && <>
                      <td className="px-4 py-3 text-sm text-violet-600">{r.p2_age ?? '—'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-violet-700">{r.p2_rmd > 0 ? formatDollars(r.p2_rmd) : '—'}</td>
                    </>}
                    <td className="px-4 py-3 text-sm font-semibold text-amber-600">{formatDollars(r.total_rmd)}</td>
                    <td className="px-4 py-3 text-xs text-neutral-400">{expandedYear === r.year ? '▲' : '▼'}</td>
                  </tr>
                  {expandedYear === r.year && (
                    <tr>
                      <td colSpan={p2Name ? 7 : 5} className="px-4 py-3 bg-neutral-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {r.p1_accounts.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-blue-600 mb-2">{p1Name}</p>
                              <div className="space-y-2">
                                {r.p1_accounts.map(a => (
                                  <div key={a.asset_id} className="rounded-lg border border-blue-100 bg-white p-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <p className="text-sm font-medium text-neutral-900">{a.asset_name}</p>
                                      <p className="text-sm font-semibold text-blue-700">{formatDollars(a.rmd_amount)}</p>
                                    </div>
                                    <div className="flex gap-4 text-xs text-neutral-400">
                                      <span>Balance: {formatDollars(a.prior_year_balance)}</span>
                                      <span>Factor: {a.life_expectancy_factor}</span>
                                    </div>
                                    {a.notes.map((n, i) => <p key={i} className="text-xs text-blue-600 mt-1">{n}</p>)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {r.p2_accounts.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-violet-600 mb-2">{p2Name}</p>
                              <div className="space-y-2">
                                {r.p2_accounts.map(a => (
                                  <div key={a.asset_id} className="rounded-lg border border-violet-100 bg-white p-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <p className="text-sm font-medium text-neutral-900">{a.asset_name}</p>
                                      <p className="text-sm font-semibold text-violet-700">{formatDollars(a.rmd_amount)}</p>
                                    </div>
                                    <div className="flex gap-4 text-xs text-neutral-400">
                                      <span>Balance: {formatDollars(a.prior_year_balance)}</span>
                                      <span>Factor: {a.life_expectancy_factor}</span>
                                    </div>
                                    {a.notes.map((n, i) => <p key={i} className="text-xs text-violet-600 mt-1">{n}</p>)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Pagination controls ── */}
        <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setPeriodOffset(p => Math.max(0, p - 1))
              setExpandedYear(null)
            }}
            disabled={periodOffset === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            ← Previous
          </button>

          <span className="text-xs text-neutral-400">
            Period {periodOffset + 1} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => {
              setPeriodOffset(p => Math.min(totalPages - 1, p + 1))
              setExpandedYear(null)
            }}
            disabled={periodOffset >= totalPages - 1}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Next →
          </button>
        </div>
      </div>

      <p className="mt-4 text-xs text-neutral-400">
        * RMD calculations use the IRS Uniform Lifetime Table (2022 final regulations).
        Balances shown are projections at {household.growth_rate_retirement ?? 5}% annual growth.
        Consult a tax advisor for your specific situation.
      </p>
    </div>
  )
}

function SummaryCard({ label, value, sub, highlight, color }: {
  label: string; value: string; sub: string; highlight?: 'amber'; color?: 'blue' | 'violet'
}) {
  return (
    <div className={`rounded-xl border px-4 py-4 shadow-sm ${color === 'blue' ? 'border-blue-200 bg-blue-50/30' : color === 'violet' ? 'border-violet-200 bg-violet-50/30' : 'border-neutral-200 bg-white'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${highlight === 'amber' ? 'text-amber-600' : color === 'blue' ? 'text-blue-700' : color === 'violet' ? 'text-violet-700' : 'text-neutral-900'}`}>{value}</p>
      <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>
    </div>
  )
}
