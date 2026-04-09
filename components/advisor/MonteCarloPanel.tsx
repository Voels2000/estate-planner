'use client'

// Sprint 71 — MonteCarloPanel
// Calls the estate-monte-carlo Supabase Edge Function
// Displays P10/P50/P90 fan chart and 3-variable sensitivity matrix
// Lives in StrategyTab below CompositeOverlay

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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
  person1BirthYear: number
  lawScenario: 'current_law' | 'sunset' | 'no_exemption'
  supabaseUrl: string
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`
const fmtK = (n: number) => `$${Math.round(n / 1000)}K`

export default function MonteCarloPanel({
  householdId,
  scenarioId,
  grossEstate,
  federalExemption,
  estimatedStateTax,
  person1BirthYear,
  lawScenario,
  supabaseUrl,
}: MonteCarloProps) {
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const [result, setResult] = useState<MonteCarloResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [simulationCount, setSimulationCount] = useState(500)
  const [strategyReduction, setStrategyReduction] = useState(0)

  const currentAge = new Date().getFullYear() - person1BirthYear
  const yearsUntilDeath = Math.max(5, 85 - currentAge)
  const stateEstateTaxRate = grossEstate > 0 ? estimatedStateTax / grossEstate : 0

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
          stateEstateTaxRate,
          yearsUntilDeath,
          strategyEstateReduction: strategyReduction,
          lawScenario,
          simulationCount,
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

  // Simple SVG fan chart
  const FanChart = ({ data }: { data: MonteCarloResult['fan_chart_data'] }) => {
    if (!data.length) return null
    const width = 600
    const height = 280
    const padding = { top: 20, right: 20, bottom: 40, left: 80 }
    const chartW = width - padding.left - padding.right
    const chartH = height - padding.top - padding.bottom

    const maxVal = Math.max(...data.map((d) => d.p90))
    const minVal = 0
    const range = maxVal - minVal

    const xScale = (i: number) => padding.left + (i / (data.length - 1)) * chartW
    const yScale = (v: number) => padding.top + chartH - ((v - minVal) / range) * chartH

    const pathD = (key: 'p10' | 'p25' | 'p50' | 'p75' | 'p90') =>
      data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d[key])}`).join(' ')

    // Band between p10 and p90
    const bandPath = [
      ...data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.p90)}`),
      ...data.map(
        (d, i) => `L${xScale(data.length - 1 - i)},${yScale(data[data.length - 1 - i].p10)}`
      ),
      'Z',
    ].join(' ')

    const bandInner = [
      ...data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.p75)}`),
      ...data.map(
        (d, i) => `L${xScale(data.length - 1 - i)},${yScale(data[data.length - 1 - i].p25)}`
      ),
      'Z',
    ].join(' ')

    // Y-axis labels
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      value: minVal + t * range,
      y: padding.top + chartH - t * chartH,
    }))

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        {/* Outer band P10-P90 */}
        <path d={bandPath} fill="#3b82f6" fillOpacity="0.15" />
        {/* Inner band P25-P75 */}
        <path d={bandInner} fill="#3b82f6" fillOpacity="0.25" />
        {/* P50 median line */}
        <path d={pathD('p50')} fill="none" stroke="#2563eb" strokeWidth="2" />
        {/* P10 and P90 dashed */}
        <path d={pathD('p10')} fill="none" stroke="#93c5fd" strokeWidth="1" strokeDasharray="4 2" />
        <path d={pathD('p90')} fill="none" stroke="#93c5fd" strokeWidth="1" strokeDasharray="4 2" />

        {/* Y-axis */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={t.y}
              x2={padding.left + chartW}
              y2={t.y}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            <text x={padding.left - 8} y={t.y + 4} textAnchor="end" fontSize="10" fill="#6b7280">
              {fmtK(t.value)}
            </text>
          </g>
        ))}

        {/* X-axis labels — every 5 years */}
        {data
          .filter((_, i) => i % 5 === 0)
          .map((d, i) => {
            const origIdx = data.findIndex((x) => x.year === d.year)
            return (
              <text
                key={i}
                x={xScale(origIdx)}
                y={height - 8}
                textAnchor="middle"
                fontSize="10"
                fill="#6b7280"
              >
                {d.year}
              </text>
            )
          })}

        {/* Legend */}
        <g transform={`translate(${padding.left + chartW - 120}, ${padding.top})`}>
          <rect width="12" height="4" y="4" fill="#3b82f6" fillOpacity="0.4" />
          <text x="16" y="10" fontSize="9" fill="#6b7280">
            P25–P75 range
          </text>
          <line x1="0" y1="22" x2="12" y2="22" stroke="#2563eb" strokeWidth="2" />
          <text x="16" y="26" fontSize="9" fill="#6b7280">
            P50 median
          </text>
        </g>
      </svg>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-1">Monte Carlo — Estate Tax Range</h3>
        <p className="text-xs text-gray-500 mb-4">
          Runs {simulationCount} market scenarios to show the range of possible estate tax outcomes.
          Based on current estate of {fmt(grossEstate)} projected {yearsUntilDeath} years.
        </p>

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
            <span className="text-xs text-gray-400">
              Completed in {(result.run_duration_ms / 1000).toFixed(1)}s
            </span>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700 mb-4">
            {error}
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
                label: 'Tax-Free Rate',
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
              <div key={card.label} className="bg-gray-50 rounded-lg p-3 text-center">
                <div className={`text-lg font-semibold ${card.color}`}>{card.value}</div>
                <div className="text-xs text-gray-500 mt-1">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Fan chart */}
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-3">Estate Value Fan Chart</h4>
            <div className="bg-white border border-gray-100 rounded-lg p-4">
              <FanChart data={result.fan_chart_data} />
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
