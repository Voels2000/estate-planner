'use client'

import { useState, useEffect, Fragment } from 'react'

type Household = {
  id: string
  person1_birth_year: number
  person1_longevity_age: number | null
  person1_retirement_age: number | null
  has_spouse: boolean
  person2_birth_year: number | null
  filing_status: string
  growth_rate_retirement: number | null
}

type Asset = {
  id: string
  name: string
  type: string
  value: number
}

type RmdAccountResult = {
  asset_id: string
  asset_name: string
  asset_type: string
  prior_year_balance: number
  owner_age: number
  table_used: string
  life_expectancy_factor: number
  rmd_amount: number
  notes: string[]
}

type RmdResult = {
  distribution_year: number
  owner_age: number
  total_rmd: number
  accounts: RmdAccountResult[]
  table_used: string
  rmd_start_age: number
  is_first_year: boolean
  first_year_deferral_available: boolean
}

function formatDollars(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function computeRmdsClient(
  household: Household,
  assets: Asset[]
): RmdResult[] {
  const currentYear = new Date().getFullYear()
  const birthYear = household.person1_birth_year
  const longevityAge = household.person1_longevity_age ?? 90
  const growthRate = (household.growth_rate_retirement ?? 5) / 100
  const startAge = currentYear - birthYear

  // SECURE Act 2.0 start age
  const rmdStartAge = birthYear >= 1960 ? 75 : birthYear >= 1951 ? 73 : 72

  // Simplified uniform lifetime factors (2022 IRS table)
  const uniformFactors: Record<number, number> = {
    72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
    78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
    84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
    90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
    96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4,
  }

  const eligibleAssets = assets.filter(a =>
    a.type === 'traditional_ira' || a.type === 'traditional_401k'
  )

  if (eligibleAssets.length === 0) return []

  const results: RmdResult[] = []
  let balances: Record<string, number> = {}
  for (const a of eligibleAssets) {
    balances[a.id] = Number(a.value)
  }

  for (let age = startAge; age <= longevityAge; age++) {
    const year = currentYear + (age - startAge)
    const isFirstYear = age === rmdStartAge

    if (age < rmdStartAge) {
      // Grow balances, no RMD yet
      for (const a of eligibleAssets) {
        balances[a.id] = Math.round(balances[a.id] * (1 + growthRate) * 100) / 100
      }
      continue
    }

    const factor = uniformFactors[Math.min(age, 100)] ?? 2.0
    const accountResults: RmdAccountResult[] = []
    let totalRmd = 0

    // 401k — individual
    const k401 = eligibleAssets.filter(a => a.type === 'traditional_401k')
    for (const a of k401) {
      const bal = balances[a.id] ?? 0
      const rmd = Math.round((bal / factor) * 100) / 100
      accountResults.push({
        asset_id: a.id,
        asset_name: a.name,
        asset_type: a.type,
        prior_year_balance: bal,
        owner_age: age,
        table_used: 'uniform',
        life_expectancy_factor: factor,
        rmd_amount: rmd,
        notes: isFirstYear ? [`First RMD year — deferral to Apr 1 available`] : [],
      })
      totalRmd += rmd
    }

    // IRA — aggregated
    const iras = eligibleAssets.filter(a => a.type === 'traditional_ira')
    if (iras.length > 0) {
      const totalIraBal = iras.reduce((s, a) => s + (balances[a.id] ?? 0), 0)
      const totalIraRmd = Math.round((totalIraBal / factor) * 100) / 100
      const perIra = Math.round((totalIraRmd / iras.length) * 100) / 100
      for (const a of iras) {
        accountResults.push({
          asset_id: a.id,
          asset_name: a.name,
          asset_type: a.type,
          prior_year_balance: balances[a.id] ?? 0,
          owner_age: age,
          table_used: 'uniform',
          life_expectancy_factor: factor,
          rmd_amount: perIra,
          notes: [
            `IRA aggregation — total IRA RMD: ${formatDollars(totalIraRmd)}`,
            ...(isFirstYear ? [`First RMD year — deferral to Apr 1 available`] : []),
          ],
        })
      }
      totalRmd += totalIraRmd
    }

    results.push({
      distribution_year: year,
      owner_age: age,
      total_rmd: Math.round(totalRmd * 100) / 100,
      accounts: accountResults,
      table_used: 'uniform',
      rmd_start_age: rmdStartAge,
      is_first_year: isFirstYear,
      first_year_deferral_available: isFirstYear,
    })

    // Grow balances for next year, subtract RMDs
    for (const a of eligibleAssets) {
      const rmdTaken = accountResults.find(r => r.asset_id === a.id)?.rmd_amount ?? 0
      balances[a.id] = Math.max(0, Math.round((balances[a.id] * (1 + growthRate) - rmdTaken) * 100) / 100)
    }
  }

  return results
}

export function RmdClient({ household, assets }: { household: Household | null; assets: Asset[] }) {
  const [results, setResults] = useState<RmdResult[]>([])
  const [expandedYear, setExpandedYear] = useState<number | null>(null)

  useEffect(() => {
    if (!household) return
    const computed = computeRmdsClient(household, assets)
    setResults(computed)
  }, [household, assets])

  if (!household) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-sm font-medium text-neutral-600">Complete your profile first</p>
          <a href="/profile" className="mt-3 text-sm text-indigo-600 hover:underline">Go to Profile →</a>
        </div>
      </div>
    )
  }

  if (assets.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-neutral-900">RMD Calculator</h1>
          <p className="mt-1 text-sm text-neutral-600">Required Minimum Distributions from tax-deferred accounts.</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <div className="text-4xl mb-3">🏦</div>
          <p className="text-sm font-medium text-neutral-600">No RMD-eligible accounts found</p>
          <p className="text-xs text-neutral-400 mt-1">Add a Traditional IRA or Traditional 401(k) to your assets</p>
          <a href="/assets" className="mt-3 text-sm text-indigo-600 hover:underline">Go to Assets →</a>
        </div>
      </div>
    )
  }

  const currentYear = new Date().getFullYear()
  const currentResult = results.find(r => r.distribution_year === currentYear)
  const firstRmdResult = results[0]
  const totalLifetimeRmd = results.reduce((s, r) => s + r.total_rmd, 0)
  const peakRmd = Math.max(...results.map(r => r.total_rmd))

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">RMD Calculator</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Required Minimum Distributions using IRS Uniform Lifetime Table (2022 regulations, SECURE Act 2.0).
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="RMD Start Age"
          value={String(firstRmdResult?.rmd_start_age ?? '—')}
          sub={household.person1_birth_year >= 1960 ? 'Born 1960+ (SECURE 2.0)' : 'Born 1951–1959'}
        />
        <SummaryCard
          label={`${currentYear} RMD`}
          value={currentResult ? formatDollars(currentResult.total_rmd) : '—'}
          sub={currentResult ? `Age ${currentResult.owner_age}` : 'Not yet required'}
          highlight={currentResult && currentResult.total_rmd > 0 ? 'amber' : undefined}
        />
        <SummaryCard
          label="Peak Annual RMD"
          value={peakRmd > 0 ? formatDollars(peakRmd) : '—'}
          sub="Highest single-year RMD"
        />
        <SummaryCard
          label="Lifetime RMDs"
          value={totalLifetimeRmd > 0 ? formatDollars(totalLifetimeRmd) : '—'}
          sub={`Through age ${household.person1_longevity_age ?? 90}`}
        />
      </div>

      {/* First year deferral notice */}
      {firstRmdResult?.first_year_deferral_available && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-3">
          <span className="text-xl mt-0.5">💡</span>
          <div>
            <p className="text-sm font-medium text-blue-900">First-Year RMD Deferral Available</p>
            <p className="text-xs text-blue-700 mt-0.5">
              Your first RMD (age {firstRmdResult.rmd_start_age}) can be deferred until April 1 of the following year.
              Note: deferring means taking two RMDs in one year, which may increase your tax bracket.
            </p>
          </div>
        </div>
      )}

      {/* Eligible accounts */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-3">RMD-Eligible Accounts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {assets.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-neutral-200 shadow-sm px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-900">{a.name}</p>
                <p className="text-xs text-neutral-400 mt-0.5 capitalize">{a.type.replace(/_/g, ' ')}</p>
              </div>
              <p className="text-sm font-semibold text-neutral-900">{formatDollars(Number(a.value))}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Year-by-year RMD table */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="text-base font-semibold text-neutral-900">Year-by-Year RMD Projection</h2>
          <p className="text-xs text-neutral-400 mt-0.5">Click a row to see per-account breakdown</p>
        </div>
        <div className="overflow-auto max-h-[500px]">
          <table className="min-w-full divide-y divide-neutral-100">
            <thead className="bg-neutral-50 sticky top-0">
              <tr>
                {['Year', 'Age', 'IRS Factor', 'Total RMD', 'Table Used', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {results.map(r => (
                <Fragment key={r.distribution_year}>
                  <tr
                    onClick={() => setExpandedYear(expandedYear === r.distribution_year ? null : r.distribution_year)}
                    className={`cursor-pointer hover:bg-neutral-50 transition-colors ${
                      r.distribution_year === currentYear ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-neutral-900">
                      {r.distribution_year}
                      {r.distribution_year === currentYear && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">Now</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-500">{r.owner_age}</td>
                    <td className="px-4 py-3 text-sm text-neutral-500">
                      {r.accounts[0]?.life_expectancy_factor ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-amber-600">
                      {formatDollars(r.total_rmd)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-500 capitalize">{r.table_used}</td>
                    <td className="px-4 py-3 text-xs text-neutral-400">
                      {expandedYear === r.distribution_year ? '▲' : '▼'}
                    </td>
                  </tr>
                  {expandedYear === r.distribution_year && (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 bg-neutral-50">
                        <div className="space-y-2">
                          {r.accounts.map(a => (
                            <div key={a.asset_id} className="rounded-lg border border-neutral-200 bg-white p-3">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-medium text-neutral-900">{a.asset_name}</p>
                                <p className="text-sm font-semibold text-amber-600">{formatDollars(a.rmd_amount)}</p>
                              </div>
                              <div className="flex gap-4 text-xs text-neutral-400">
                                <span>Balance: {formatDollars(a.prior_year_balance)}</span>
                                <span>Factor: {a.life_expectancy_factor}</span>
                                <span className="capitalize">Table: {a.table_used}</span>
                              </div>
                              {a.notes.length > 0 && (
                                <div className="mt-1.5 space-y-0.5">
                                  {a.notes.map((note, i) => (
                                    <p key={i} className="text-xs text-blue-600">{note}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-4 text-xs text-neutral-400">
        * RMD calculations use the IRS Uniform Lifetime Table (2022 final regulations).
        Balances shown are projections at {(household.growth_rate_retirement ?? 5)}% annual growth.
        Consult a tax advisor for your specific situation.
      </p>
    </div>
  )
}

function SummaryCard({ label, value, sub, highlight }: {
  label: string; value: string; sub: string; highlight?: 'amber'
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${highlight === 'amber' ? 'text-amber-600' : 'text-neutral-900'}`}>{value}</p>
      <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>
    </div>
  )
}
