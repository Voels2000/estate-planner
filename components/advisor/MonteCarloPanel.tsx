'use client'

/**
 * Advisor Monte Carlo visualization panel.
 *
 * Calls the Monte Carlo edge function for a household/scenario and renders fan-chart
 * and sensitivity outputs used in advisor strategy review.
 */

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MonteCarloAssumptions } from '@/lib/calculations/monteCarlo'
import { MC_DEPLETION_FLOOR } from '@/lib/calculations/estate-monte-carlo'
import type { StateBracket } from '@/lib/calculations/stateEstateTax'
import { MonteCarloFanChart } from '@/components/advisor/MonteCarloFanChart'

interface MonteCarloResult {
  p10_estate: number
  p25_estate: number
  p50_estate: number
  p75_estate: number
  p90_estate: number
  p10_tax: number
  p50_tax: number
  p90_tax: number
  success_rate: number
  median_net_to_heirs: number
  fan_chart_data: Array<{
    year: number
    p10: number
    p25: number
    p50: number
    p75: number
    p90: number
  }>
  sensitivity_matrix: Array<{
    variable: string
    low_value: number
    low_tax: number
    base_tax: number
    high_value: number
    high_tax: number
  }>
  run_duration_ms: number
}

interface MonteCarloProps {
  householdId: string
  scenarioId?: string
  grossEstate: number
  federalExemption: number
  estimatedStateTax: number
  stateCode: string
  stateBrackets: StateBracket[]
  filingStatus: 'single' | 'mfj'
  hasBypassTrust: boolean
  person1BirthYear: number
  lawScenario: 'current_law' | 'no_exemption'
  supabaseUrl: string
  assumptions?: MonteCarloAssumptions
  mcCalculatedAt?: string | null
  longevityDepletionPct?: number | null
  depletionFloorAmount?: number | null
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`
const fmtK = (n: number) => `$${Math.round(n / 1000)}K`

export default function MonteCarloPanel({
  householdId,
  scenarioId,
  grossEstate,
  federalExemption,
  estimatedStateTax,
  stateCode,
  stateBrackets,
  filingStatus,
  hasBypassTrust,
  person1BirthYear,
  lawScenario,
  supabaseUrl,
  assumptions,
  mcCalculatedAt = null,
  longevityDepletionPct = null,
  depletionFloorAmount = null,
}: MonteCarloProps) {
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const [result, setResult] = useState<MonteCarloResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [simulationCount, setSimulationCount] = useState(500)
  const [strategyReduction, setStrategyReduction] = useState(0)

  const currentAge = new Date().getFullYear() - person1BirthYear
  const yearsUntilDeath = Math.max(5, 85 - currentAge)
  const showDepletionTile = longevityDepletionPct !== null && longevityDepletionPct !== undefined
  const depletionFloor = depletionFloorAmount ?? MC_DEPLETION_FLOOR
  const depletionColor =
    longevityDepletionPct != null && longevityDepletionPct > 20 ? 'text-red-600' : 'text-green-700'

  const DepletionRiskTile = () =>
    showDepletionTile ? (
      <div className="bg-gray-50 rounded-lg p-3 text-center">
        <div className={`text-lg font-semibold ${depletionColor}`}>{longevityDepletionPct}%</div>
        <div className="text-xs text-gray-500 mt-1">Depletion Risk</div>
        <div className="text-[10px] leading-snug text-gray-400 mt-1 px-1">
          % of scenarios below {fmt(depletionFloor)} at death
        </div>
      </div>
    ) : null

  const runMonteCarlo = async () => {
    setLoading(true)
    setError(null)
    try {
      // Get auth token from Supabase session
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setError('Not authenticated')
        return
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/estate-monte-carlo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          householdId,
          scenarioId,
          grossEstate,
          federalExemption,
          stateCode,
          stateBrackets,
          filingStatus,
          hasBypassTrust,
          yearsUntilDeath,
          strategyEstateReduction: strategyReduction,
          lawScenario,
          simulationCount,
          assumptions,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        setError(err.error ?? 'Monte Carlo failed')
        return
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-1">Monte Carlo — Estate Tax Range</h3>
        <p className="text-xs text-gray-500 mb-4">
          Runs {simulationCount} market scenarios to show the range of possible estate tax outcomes.
          Based on current estate of {fmt(grossEstate)} projected {yearsUntilDeath} years.
        </p>
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Model assumptions</p>
          <ul className="mt-1 space-y-1 text-xs text-slate-600">
            <li>Market returns: normal distribution (mean 7.0%, std dev 12.0%).</li>
            <li>Federal estate tax: 40% above exemption (or 0 exemption in no-exemption mode).</li>
            <li>
              State estate tax: progressive brackets for domicile state (same as Strategy horizons), with
              MFJ/single filing and credit shelter trust status applied per path.
            </li>
            <li>Horizon to death: max(5 years, 85 − current age).</li>
          </ul>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Simulations</label>
            <select
              value={simulationCount}
              onChange={(e) => setSimulationCount(Number(e.target.value))}
              className="border border-gray-200 rounded px-3 py-1.5 text-sm"
            >
              <option value={250}>250 (fast)</option>
              <option value={500}>500 (standard)</option>
              <option value={1000}>1,000 (precise)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Strategy Reduction ($)</label>
            <input
              type="number"
              value={strategyReduction}
              onChange={(e) => setStrategyReduction(Number(e.target.value))}
              placeholder="0"
              className="border border-gray-200 rounded px-3 py-1.5 text-sm w-40"
            />
          </div>
          <button
            onClick={runMonteCarlo}
            disabled={loading}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
              loading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading ? 'Running...' : 'Run Monte Carlo'}
          </button>
          {result && (
            <div className="flex flex-col">
              <span className="text-xs text-gray-400">
                Completed in {(result.run_duration_ms / 1000).toFixed(1)}s
              </span>
              {mcCalculatedAt ? (
                <p className="mt-1 text-xs text-[--mwm-text-muted]">
                  Last precomputed: {new Date(mcCalculatedAt).toLocaleDateString()}
                </p>
              ) : null}
            </div>
          )}
          {!result && mcCalculatedAt ? (
            <p className="text-xs text-[--mwm-text-muted]">
              Last precomputed: {new Date(mcCalculatedAt).toLocaleDateString()}
            </p>
          ) : null}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700 mb-4">
            {error}
          </div>
        )}

        {showDepletionTile && !result && !loading && (
          <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <DepletionRiskTile />
          </div>
        )}

        {!result && !loading && !error && (
          <div className="mb-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-[color:var(--mwm-border-secondary)] py-10 text-center">
            <i
              className="ti ti-chart-dots mb-3 text-[color:var(--mwm-text-secondary)]"
              aria-hidden="true"
              style={{ fontSize: 28 }}
            />
            <p className="mb-1 text-sm font-medium text-[color:var(--mwm-text-secondary)]">
              Run simulation to see probability distribution
            </p>
            <p className="text-xs text-[color:var(--mwm-text-secondary)]">
              Shows P10/P50/P90 estate tax outcomes across {simulationCount} market scenarios
            </p>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-8 text-center">
          <div className="text-blue-600 text-sm font-medium mb-2">
            Running {simulationCount} simulations...
          </div>
          <div className="text-xs text-blue-400">This may take a few seconds</div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Zero-Tax Paths',
                hint: 'Share of simulations where federal + state estate tax both equal $0',
                value: `${result.success_rate}%`,
                color: result.success_rate > 50 ? 'text-green-700' : 'text-red-600',
              },
              { label: 'P50 Estate Tax', value: fmt(result.p50_tax), color: 'text-red-600' },
              { label: 'P90 Estate Tax', value: fmt(result.p90_tax), color: 'text-red-400' },
              {
                label: 'Median Net to Heirs',
                value: fmt(result.median_net_to_heirs),
                color: 'text-blue-700',
              },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-gray-50 rounded-lg p-3 text-center"
                title={'hint' in card ? card.hint : undefined}
              >
                <div className={`text-lg font-semibold ${card.color}`}>{card.value}</div>
                <div className="text-xs text-gray-500 mt-1">{card.label}</div>
                {'hint' in card && card.hint ? (
                  <div className="text-[10px] leading-snug text-gray-400 mt-1 px-1">{card.hint}</div>
                ) : null}
              </div>
            ))}
            {showDepletionTile ? <DepletionRiskTile /> : null}
          </div>

          {/* Fan chart */}
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-3">Estate Value Fan Chart</h4>
            <div className="bg-white border border-gray-100 rounded-lg p-4">
              <MonteCarloFanChart data={result.fan_chart_data} />
            </div>
          </div>

          {/* Percentile table */}
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-3">Outcome Range at Death</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Scenario</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">Estate Value</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">Estate Tax</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">Net to Heirs</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'P10 (Bear market)', estate: result.p10_estate, tax: result.p10_tax },
                    { label: 'P50 (Median)', estate: result.p50_estate, tax: result.p50_tax },
                    { label: 'P90 (Bull market)', estate: result.p90_estate, tax: result.p90_tax },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-700">{row.label}</td>
                      <td className="py-2 px-3 text-right">{fmt(row.estate)}</td>
                      <td className="py-2 px-3 text-right text-red-600">{fmt(row.tax)}</td>
                      <td className="py-2 px-3 text-right font-medium">{fmt(row.estate - row.tax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sensitivity matrix */}
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-3">Sensitivity Analysis</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Variable</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">Low Case Tax</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">Base Case Tax</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">High Case Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {result.sensitivity_matrix.map((row) => (
                    <tr key={row.variable} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-700">{row.variable}</td>
                      <td className="py-2 px-3 text-right text-green-700">{fmt(row.low_tax)}</td>
                      <td className="py-2 px-3 text-right">{fmt(row.base_tax)}</td>
                      <td className="py-2 px-3 text-right text-red-600">{fmt(row.high_tax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
