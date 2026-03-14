'use client'

import { useState } from 'react'
import { runScenarioProjection, type ScenarioAssumptions } from './actions'
import type { ProjectionYear } from '@/lib/calculations/projection'

const CURRENT_YEAR = new Date().getFullYear()

/** Common US state codes for scenario state selector */
const STATE_OPTIONS = [
  '',
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]

const SS_CLAIMING_AGES = [62, 63, 64, 65, 66, 67, 68, 69, 70]

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export type ScenarioConfig = ScenarioAssumptions & { name: string }

type ScenarioResult = {
  assumptions: ScenarioConfig
  data: ProjectionYear[] | null
  error: string | null
}

type Props = {
  householdId: string
  person1BirthYear: number
  defaultStatePrimary: string | null
  defaultRetirementAge: number | null
  defaultSsClaimingAge: number | null
}

const defaultScenario = (defaults: {
  statePrimary: string | null
  retirementAge: number | null
  ssClaimingAge: number | null
}): ScenarioConfig => ({
  name: '',
  retirement_age: defaults.retirementAge,
  investment_return_pct: 5,
  ss_claiming_age: defaults.ssClaimingAge,
  state_primary: defaults.statePrimary ?? '',
})

function scenarioSummary(projection: ProjectionYear[]) {
  if (projection.length === 0) return null
  const first = projection[0]
  const last = projection[projection.length - 1]
  const peak = projection.reduce(
    (max, row) => (row.total_net_worth > max ? row.total_net_worth : max),
    0
  )
  const avgCashFlow =
    projection.reduce((sum, row) => sum + row.net_cash_flow, 0) / projection.length
  const totalFederal = projection.reduce((sum, row) => sum + row.federal_tax, 0)
  const totalState = projection.reduce((sum, row) => sum + row.state_tax, 0)
  return {
    startingNetWorth: first.total_net_worth,
    endingNetWorth: last.total_net_worth,
    peakNetWorth: peak,
    avgCashFlow,
    totalFederalTax: totalFederal,
    totalStateTax: totalState,
  }
}

export function ScenariosView({
  householdId,
  person1BirthYear,
  defaultStatePrimary,
  defaultRetirementAge,
  defaultSsClaimingAge,
}: Props) {
  const defaults = {
    statePrimary: defaultStatePrimary,
    retirementAge: defaultRetirementAge,
    ssClaimingAge: defaultSsClaimingAge,
  }

  const [scenarios, setScenarios] = useState<ScenarioConfig[]>([
    defaultScenario(defaults),
    defaultScenario(defaults),
    defaultScenario(defaults),
  ])
  const [results, setResults] = useState<ScenarioResult[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingScenarioIndex, setLoadingScenarioIndex] = useState<number | null>(null)
  const [compareCount, setCompareCount] = useState(1)

  function updateScenario(index: number, updates: Partial<ScenarioConfig>) {
    setScenarios((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      return next
    })
  }

  async function handleCompare() {
    setLoading(true)
    setResults([])
    const count = Math.min(3, Math.max(1, compareCount))
    const toRun = scenarios.slice(0, count)
    const opts = {
      start_year: CURRENT_YEAR,
      end_year: CURRENT_YEAR + 40,
      person1_birth_year: person1BirthYear,
    }
    const nextResults: ScenarioResult[] = []
    for (const config of toRun) {
      const { data, error } = await runScenarioProjection(
        householdId,
        opts,
        {
          retirement_age: config.retirement_age,
          investment_return_pct: config.investment_return_pct,
          ss_claiming_age: config.ss_claiming_age,
          state_primary: config.state_primary || null,
        }
      )
      nextResults.push({
        assumptions: config,
        data: data ?? null,
        error,
      })
    }
    setResults(nextResults)
    setLoading(false)
  }

  async function handleApplyChanges(index: number) {
    const opts = {
      start_year: CURRENT_YEAR,
      end_year: CURRENT_YEAR + 40,
      person1_birth_year: person1BirthYear,
    }
    const config = scenarios[index]
    const assumptions = {
      retirement_age: config.retirement_age,
      investment_return_pct: config.investment_return_pct,
      ss_claiming_age: config.ss_claiming_age,
      state_primary: config.state_primary || null,
    }

    setLoadingScenarioIndex(index)
    try {
      const { data, error } = await runScenarioProjection(
        householdId,
        opts,
        assumptions
      )
      setResults((prev) => {
        const next = [...prev]
        while (next.length <= index) {
          next.push({
            assumptions: scenarios[next.length],
            data: null,
            error: null,
          })
        }
        next[index] = {
          assumptions: config,
          data: data ?? null,
          error,
        }
        return next
      })
    } finally {
      setLoadingScenarioIndex(null)
    }
  }

  const hasResults = results.length > 0
  const summaries = results.map((r) =>
    r.data ? scenarioSummary(r.data) : null
  )

  const inputClass =
    'block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100 dark:focus:ring-zinc-100'
  const labelClass = 'block text-sm font-medium text-zinc-800 dark:text-zinc-200'

  const gridColsClass =
    compareCount === 1
      ? 'grid-cols-1'
      : compareCount === 2
        ? 'grid-cols-2'
        : 'grid-cols-3'

  return (
    <div className="mt-6 w-full space-y-6">
      {/* Scenario count */}
      <div className="flex flex-wrap items-center gap-4">
        <label className={labelClass}>Compare</label>
        <select
          value={compareCount}
          onChange={(e) => setCompareCount(Number(e.target.value))}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n} scenario{n > 1 ? 's' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Scenario cards — horizontal grid, 1–3 equal columns */}
      <div
        className={`grid w-full gap-4 ${gridColsClass} min-w-0`}
        style={{ gridTemplateColumns: `repeat(${compareCount}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: compareCount }, (_, i) => (
          <div
            key={i}
            className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Scenario {i + 1}
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Name (optional)</label>
                <input
                  type="text"
                  placeholder={`Scenario ${i + 1}`}
                  value={scenarios[i].name}
                  onChange={(e) => updateScenario(i, { name: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Retirement age</label>
                <input
                  type="number"
                  min={55}
                  max={80}
                  placeholder="e.g. 65"
                  value={scenarios[i].retirement_age ?? ''}
                  onChange={(e) =>
                    updateScenario(i, {
                      retirement_age: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Investment return (%)</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.5}
                  value={scenarios[i].investment_return_pct ?? ''}
                  onChange={(e) =>
                    updateScenario(i, {
                      investment_return_pct: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Social Security claiming age</label>
                <select
                  value={scenarios[i].ss_claiming_age ?? ''}
                  onChange={(e) =>
                    updateScenario(i, {
                      ss_claiming_age: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  className={inputClass}
                >
                  <option value="">—</option>
                  {SS_CLAIMING_AGES.map((age) => (
                    <option key={age} value={age}>
                      {age}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>State of residence</label>
                <select
                  value={scenarios[i].state_primary ?? ''}
                  onChange={(e) =>
                    updateScenario(i, {
                      state_primary: e.target.value || null,
                    })
                  }
                  className={inputClass}
                >
                  {STATE_OPTIONS.map((code) => (
                    <option key={code || 'empty'} value={code}>
                      {code || '— None —'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => handleApplyChanges(i)}
                  disabled={loading || loadingScenarioIndex !== null}
                  className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-70 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {loadingScenarioIndex === i
                    ? 'Applying…'
                    : 'Apply changes'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <button
          type="button"
          onClick={handleCompare}
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-70 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? 'Running…' : 'Compare scenarios'}
        </button>
      </div>

      {/* Errors */}
      {results.some((r) => r.error) && (
        <div className="space-y-2">
          {results.map(
            (r, i) =>
              r.error && (
                <div
                  key={i}
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
                >
                  Scenario {i + 1}: {r.error}
                </div>
              )
          )}
        </div>
      )}

      {/* Key metrics — same grid as scenarios for aligned columns */}
      {hasResults && summaries.some(Boolean) && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            Key metrics
          </h2>
          <div
            className={`grid w-full gap-4 ${gridColsClass} min-w-0`}
            style={{ gridTemplateColumns: `repeat(${compareCount}, minmax(0, 1fr))` }}
          >
            {results.map((r, i) => (
              <div
                key={i}
                className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {r.assumptions.name || `Scenario ${i + 1}`}
                </h3>
                {summaries[i] ? (
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between gap-2">
                      <span className="text-zinc-600 dark:text-zinc-400">Starting net worth</span>
                      <span className="tabular-nums font-medium">{formatCurrency(summaries[i]!.startingNetWorth)}</span>
                    </li>
                    <li className="flex justify-between gap-2">
                      <span className="text-zinc-600 dark:text-zinc-400">Ending net worth</span>
                      <span className="tabular-nums font-medium">{formatCurrency(summaries[i]!.endingNetWorth)}</span>
                    </li>
                    <li className="flex justify-between gap-2">
                      <span className="text-zinc-600 dark:text-zinc-400">Peak net worth</span>
                      <span className="tabular-nums font-medium">{formatCurrency(summaries[i]!.peakNetWorth)}</span>
                    </li>
                    <li className="flex justify-between gap-2">
                      <span className="text-zinc-600 dark:text-zinc-400">Avg. annual cash flow</span>
                      <span className="tabular-nums font-medium">{formatCurrency(summaries[i]!.avgCashFlow)}</span>
                    </li>
                    <li className="flex justify-between gap-2">
                      <span className="text-zinc-600 dark:text-zinc-400">Total federal tax</span>
                      <span className="tabular-nums font-medium">{formatCurrency(summaries[i]!.totalFederalTax)}</span>
                    </li>
                    <li className="flex justify-between gap-2">
                      <span className="text-zinc-600 dark:text-zinc-400">Total state tax</span>
                      <span className="tabular-nums font-medium">{formatCurrency(summaries[i]!.totalStateTax)}</span>
                    </li>
                  </ul>
                ) : (
                  <p className="text-sm text-zinc-500">—</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison table — full width, columns align with scenario columns */}
      {hasResults && summaries.some(Boolean) && (
        <div className="w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <h2 className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-50">
            Side-by-side comparison
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed divide-y divide-zinc-200 dark:divide-zinc-700">
              <colgroup>
                <col className="w-[200px] min-w-[140px]" />
                {results.map((_, i) => (
                  <col key={i} style={{ width: `calc((100% - 200px) / ${results.length})` }} />
                ))}
              </colgroup>
              <thead className="bg-zinc-50 dark:bg-zinc-900/80">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                  >
                    Metric
                  </th>
                  {results.map((r, i) => (
                    <th
                      key={i}
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                    >
                      {r.assumptions.name || `Scenario ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-950">
                <ComparisonRow
                  label="Starting net worth"
                  summaries={summaries}
                  getValue={(s) => s?.startingNetWorth}
                />
                <ComparisonRow
                  label="Ending net worth"
                  summaries={summaries}
                  getValue={(s) => s?.endingNetWorth}
                />
                <ComparisonRow
                  label="Peak net worth"
                  summaries={summaries}
                  getValue={(s) => s?.peakNetWorth}
                />
                <ComparisonRow
                  label="Avg. annual net cash flow"
                  summaries={summaries}
                  getValue={(s) => s?.avgCashFlow}
                />
                <ComparisonRow
                  label="Total federal tax (projection period)"
                  summaries={summaries}
                  getValue={(s) => s?.totalFederalTax}
                />
                <ComparisonRow
                  label="Total state tax (projection period)"
                  summaries={summaries}
                  getValue={(s) => s?.totalStateTax}
                />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function ComparisonRow({
  label,
  summaries,
  getValue,
}: {
  label: string
  summaries: (ReturnType<typeof scenarioSummary>)[]
  getValue: (s: NonNullable<ReturnType<typeof scenarioSummary>>) => number
}) {
  return (
    <tr className="text-zinc-900 dark:text-zinc-100">
      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
        {label}
      </td>
      {summaries.map((s, i) => (
        <td
          key={i}
          className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums"
        >
          {s != null ? formatCurrency(getValue(s)) : '—'}
        </td>
      ))}
    </tr>
  )
}
