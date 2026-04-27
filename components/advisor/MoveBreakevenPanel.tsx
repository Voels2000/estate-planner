'use client'
/**
 * components/advisor/MoveBreakevenPanel.tsx
 * Session 38 — Move Breakeven Analysis
 *
 * Advisor-facing panel. Receives pre-fetched tax tables + household data as props.
 * All calculation happens in lib/domicile/moveBreakeven.ts — this component is pure UI.
 *
 * Inputs the advisor can adjust:
 *   - Target state (dropdown from states the client spends time in, or freeform)
 *   - Annual income
 *   - Move cost (legal + real estate friction)
 *   - Annual compliance cost delta
 *   - Discount rate
 *   - Horizon
 *   - Estate growth rate
 *
 * Outputs:
 *   - Breakeven timeline card + progress bar
 *   - Annual savings breakdown (income vs estate)
 *   - NPV verdict
 *   - Year-by-year cumulative savings chart (SVG sparkline)
 *   - Sensitivity table (estate ±20%)
 */

import { useMemo, useState } from 'react'
import {
  calculateMoveBreakeven,
  type MoveBreakevenInput,
  type MoveBreakevenResult,
  type StateEstateTaxRule,
  type StateIncomeTaxRate,
} from '@/lib/domicile/moveBreakeven'

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

type Props = {
  /** Current claimed domicile (2-letter) */
  currentState: string
  /** Gross estate from projection / RPC */
  grossEstate: number
  /** MFJ filing status */
  isMFJ: boolean
  /** States the client has days in — populate target dropdown */
  clientStates: Array<{ state: string; days_per_year: number }>
  /** From state_income_tax_rates table */
  incomeTaxRates: StateIncomeTaxRate[]
  /** From state_estate_tax_rules table */
  estateTaxRules: StateEstateTaxRule[]
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function fmt$(n: number, decimals = 0): string {
  if (!isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(n)
}

function fmtPct(n: number | null): string {
  if (n === null) return 'None'
  if (n === 0) return 'None'
  return `${n.toFixed(2)}%`
}

function fmtYrs(n: number | null): string {
  if (n === null) return 'Never'
  return `${n.toFixed(1)} yrs`
}

// ── Sparkline SVG ────────────────────────────────────────────────

function Sparkline({ data, height = 80 }: { data: number[]; height?: number }) {
  const W = 420
  const H = height
  const pad = 8

  if (data.length < 2) return null

  const min = Math.min(0, ...data)
  const max = Math.max(0, ...data)
  const range = max - min || 1

  const toX = (i: number) => pad + (i / (data.length - 1)) * (W - pad * 2)
  const toY = (v: number) => H - pad - ((v - min) / range) * (H - pad * 2)

  const zeroY = toY(0)

  const pathD = data
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`)
    .join(' ')

  // Fill area under the line (clipped to above/below zero)
  const fillD =
    `M ${toX(0).toFixed(1)} ${zeroY.toFixed(1)} ` +
    data.map((v, i) => `L ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ') +
    ` L ${toX(data.length - 1).toFixed(1)} ${zeroY.toFixed(1)} Z`

  const lastVal = data[data.length - 1]
  const lineColor = lastVal >= 0 ? '#10b981' : '#ef4444'
  const fillColor = lastVal >= 0 ? '#10b98122' : '#ef444422'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      {/* Zero line */}
      <line
        x1={pad} y1={zeroY} x2={W - pad} y2={zeroY}
        stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 3"
      />
      {/* Fill */}
      <path d={fillD} fill={fillColor} />
      {/* Line */}
      <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" />
      {/* End dot */}
      <circle
        cx={toX(data.length - 1)} cy={toY(lastVal)}
        r="4" fill={lineColor}
      />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────

const ALL_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

export default function MoveBreakevenPanel({
  currentState,
  grossEstate,
  isMFJ,
  clientStates,
  incomeTaxRates,
  estateTaxRules,
}: Props) {
  // ── Inputs ───────────────────────────────────────────────────
  const otherClientStates = clientStates
    .filter((s) => s.state !== currentState)
    .sort((a, b) => b.days_per_year - a.days_per_year)

  const defaultTarget = otherClientStates[0]?.state ?? (currentState === 'WA' ? 'FL' : 'WA')

  const [targetState,            setTargetState]            = useState(defaultTarget)
  const [annualIncome,           setAnnualIncome]           = useState(500_000)
  const [moveCostTotal,          setMoveCostTotal]          = useState(75_000)
  const [annualComplianceDelta,  setAnnualComplianceDelta]  = useState(0)
  const [discountRate,           setDiscountRate]           = useState(0.05)
  const [horizonYears,           setHorizonYears]           = useState(20)
  const [estateGrowthRate,       setEstateGrowthRate]       = useState(0.04)

  // ── Calculation ───────────────────────────────────────────────
  const result: MoveBreakevenResult | null = useMemo(() => {
    if (!targetState || targetState === currentState) return null
    const inp: MoveBreakevenInput = {
      currentState,
      targetState,
      annualIncome,
      grossEstate,
      isMFJ,
      moveCostTotal,
      annualComplianceCostDelta: annualComplianceDelta,
      discountRate,
      horizonYears,
      estateGrowthRate,
      incomeTaxRates,
      estateTaxRules,
    }
    return calculateMoveBreakeven(inp)
  }, [
    currentState, targetState, annualIncome, grossEstate, isMFJ,
    moveCostTotal, annualComplianceDelta, discountRate, horizonYears,
    estateGrowthRate, incomeTaxRates, estateTaxRules,
  ])

  const verdictColor = !result
    ? 'text-slate-500'
    : result.npvOfMove > 0
    ? 'text-emerald-700'
    : 'text-red-700'

  const verdictBg = !result
    ? 'bg-slate-50 border-slate-200'
    : result.npvOfMove > 0
    ? 'bg-emerald-50 border-emerald-200'
    : 'bg-red-50 border-red-200'

  const sparkData = result?.yearByYear.map((y) => y.netPosition) ?? []

  const targetOptions = [
    ...otherClientStates.map((s) => s.state),
    ...ALL_STATES.filter(
      (s) => s !== currentState && !otherClientStates.find((x) => x.state === s)
    ),
  ]

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-6">

      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700">Move Breakeven Analysis</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Compares income tax + estate tax burden between current and target domicile,
          net of one-time move costs. Adjust inputs below.
        </p>
      </div>

      {/* ── Input grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">

        {/* Current state — read only */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Current domicile
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            {currentState}
          </div>
        </div>

        {/* Target state */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Target domicile
          </label>
          <select
            value={targetState}
            onChange={(e) => setTargetState(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            {otherClientStates.length > 0 && (
              <optgroup label="Client's other states">
                {otherClientStates.map((s) => (
                  <option key={s.state} value={s.state}>
                    {s.state} ({s.days_per_year} days/yr)
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="All states">
              {targetOptions
                .filter((s) => !otherClientStates.find((x) => x.state === s))
                .map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
            </optgroup>
          </select>
        </div>

        {/* Annual income */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Annual taxable income
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              type="number"
              value={annualIncome}
              onChange={(e) => setAnnualIncome(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
              min={0}
              step={10000}
            />
          </div>
        </div>

        {/* Move cost */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            One-time move cost
            <span className="ml-1 text-slate-400 font-normal">(legal + RE friction)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              type="number"
              value={moveCostTotal}
              onChange={(e) => setMoveCostTotal(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
              min={0}
              step={5000}
            />
          </div>
        </div>

        {/* Compliance delta */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Annual compliance cost delta
            <span className="ml-1 text-slate-400 font-normal">(new state overhead)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              type="number"
              value={annualComplianceDelta}
              onChange={(e) => setAnnualComplianceDelta(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
              min={0}
              step={500}
            />
          </div>
        </div>

        {/* Discount rate */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Discount rate (NPV)
          </label>
          <div className="relative">
            <input
              type="number"
              value={(discountRate * 100).toFixed(1)}
              onChange={(e) => setDiscountRate(Number(e.target.value) / 100)}
              className="w-full rounded-lg border border-slate-200 px-3 pr-8 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
              min={0}
              max={20}
              step={0.5}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
          </div>
        </div>

        {/* Horizon */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Planning horizon
          </label>
          <div className="relative">
            <input
              type="number"
              value={horizonYears}
              onChange={(e) => setHorizonYears(Math.max(1, Math.min(50, Number(e.target.value))))}
              className="w-full rounded-lg border border-slate-200 px-3 pr-14 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
              min={1}
              max={50}
              step={1}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">yrs</span>
          </div>
        </div>

        {/* Estate growth */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Estate growth rate
          </label>
          <div className="relative">
            <input
              type="number"
              value={(estateGrowthRate * 100).toFixed(1)}
              onChange={(e) => setEstateGrowthRate(Number(e.target.value) / 100)}
              className="w-full rounded-lg border border-slate-200 px-3 pr-8 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
              min={0}
              max={20}
              step={0.5}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
          </div>
        </div>
      </div>

      {/* ── Results ──────────────────────────────────────────────── */}
      {result && (
        <div className="space-y-5 pt-1">

          {/* Verdict card */}
          <div className={`rounded-xl border p-5 ${verdictBg}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                  NPV of Move ({horizonYears}-yr horizon)
                </p>
                <p className={`text-4xl font-bold tabular-nums ${verdictColor}`}>
                  {fmt$(result.npvOfMove)}
                </p>
                <p className={`text-sm font-medium mt-1 ${verdictColor}`}>
                  {result.moveIsFinanciallyJustified
                    ? 'Move is financially justified'
                    : 'Move does not break even within horizon'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                  Breakeven
                </p>
                <p className={`text-3xl font-bold tabular-nums ${verdictColor}`}>
                  {fmtYrs(result.breakevenYearExact)}
                </p>
                <p className="text-xs text-slate-400 mt-1">from move date</p>
              </div>
            </div>
          </div>

          {/* Tax rate comparison */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-4">
              Tax rate comparison
            </h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-400 mb-1">Income tax — {result.currentState}</p>
                <p className="text-xl font-semibold text-slate-700">
                  {fmtPct(result.currentIncomeTaxRate)}
                </p>
              </div>
              <div className="flex items-center justify-center">
                <span className="text-slate-300 text-2xl">→</span>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Income tax — {result.targetState}</p>
                <p className="text-xl font-semibold text-slate-700">
                  {fmtPct(result.targetIncomeTaxRate)}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400 mb-1">Estate tax — {result.currentState}</p>
                <p className="text-xl font-semibold text-slate-700">
                  {fmt$(result.currentEstateTax)}
                </p>
              </div>
              <div className="flex items-center justify-center">
                <span className="text-slate-300 text-2xl">→</span>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Estate tax — {result.targetState}</p>
                <p className="text-xl font-semibold text-slate-700">
                  {fmt$(result.targetEstateTax)}
                </p>
              </div>
            </div>
          </div>

          {/* Annual savings breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-4">
              Annual savings breakdown
            </h4>
            <div className="space-y-3">
              {[
                {
                  label: 'Income tax savings/yr',
                  value: result.annualIncomeTaxSavings,
                  note: `On ${fmt$(annualIncome)} income`,
                },
                {
                  label: 'Estate tax savings (amortized/yr)',
                  value: result.estateTaxAnnualEquivalent,
                  note: `${fmt$(result.estateTaxDeltaTotal)} total ÷ ${horizonYears} yrs`,
                },
                {
                  label: 'Annual compliance cost delta',
                  value: -annualComplianceDelta,
                  note: 'Additional professional fees in target state',
                },
              ].map((row) => {
                const isNeg = row.value < 0
                return (
                  <div key={row.label} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-700">{row.label}</p>
                      <p className="text-xs text-slate-400">{row.note}</p>
                    </div>
                    <p className={`text-sm font-semibold tabular-nums ${isNeg ? 'text-red-600' : 'text-emerald-600'}`}>
                      {isNeg ? '−' : '+'}{fmt$(Math.abs(row.value))}
                    </p>
                  </div>
                )
              })}

              <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Net annual benefit</p>
                <p className={`text-sm font-bold tabular-nums ${result.netAnnualBenefit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {result.netAnnualBenefit >= 0 ? '+' : '−'}{fmt$(Math.abs(result.netAnnualBenefit))}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-700">One-time move cost</p>
                <p className="text-sm font-semibold tabular-nums text-red-600">
                  −{fmt$(result.moveCostTotal)}
                </p>
              </div>
            </div>
          </div>

          {/* Sparkline chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Cumulative net position over {horizonYears} years
              </h4>
              <p className="text-xs text-slate-400">
                Starts at −{fmt$(result.moveCostTotal)} (move cost)
              </p>
            </div>
            <Sparkline data={sparkData} height={80} />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Year 1</span>
              <span className={result.yearByYear[result.yearByYear.length - 1]?.netPosition >= 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                Year {horizonYears}: {fmt$(result.yearByYear[result.yearByYear.length - 1]?.netPosition ?? 0)}
              </span>
            </div>
          </div>

          {/* Sensitivity table */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
              Sensitivity — estate value
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              How the move performs if the estate grows slower or faster than assumed.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 pr-4 text-xs font-medium text-slate-500">Scenario</th>
                    <th className="text-left py-2 pr-4 text-xs font-medium text-slate-500">Estate at move</th>
                    <th className="text-left py-2 pr-4 text-xs font-medium text-slate-500">Breakeven</th>
                    <th className="text-right py-2 text-xs font-medium text-slate-500">NPV ({horizonYears} yr)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      label: '−20% estate',
                      estate: grossEstate * 0.8,
                      data: result.sensitivity.estateDown20,
                    },
                    {
                      label: 'Base case',
                      estate: grossEstate,
                      data: result.sensitivity.base,
                      isBase: true,
                    },
                    {
                      label: '+20% estate',
                      estate: grossEstate * 1.2,
                      data: result.sensitivity.estateUp20,
                    },
                  ].map((row) => (
                    <tr
                      key={row.label}
                      className={`border-b border-slate-50 ${row.isBase ? 'bg-slate-50' : ''}`}
                    >
                      <td className="py-2.5 pr-4 font-medium text-slate-700">
                        {row.label}
                        {row.isBase && (
                          <span className="ml-2 text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                            base
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600">{fmt$(row.estate)}</td>
                      <td className="py-2.5 pr-4 text-slate-600">{fmtYrs(row.data.breakevenYears)}</td>
                      <td className={`py-2.5 text-right font-semibold tabular-nums ${
                        row.data.npv >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}>
                        {row.data.npv >= 0 ? '+' : ''}{fmt$(row.data.npv)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-slate-400 leading-relaxed">
            This analysis uses top marginal state income tax rates and progressive estate tax brackets
            from the database. It does not account for federal deductions, local taxes, or non-financial
            factors. Estate tax is modeled at the projected gross estate for each year using live
            brackets from <code className="text-slate-500">state_estate_tax_rules</code>.
            Consult an estate planning attorney before making domicile decisions.
          </p>
        </div>
      )}

      {!result && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-slate-400">
          <p className="text-sm">Select a target state above to run the breakeven analysis.</p>
        </div>
      )}
    </div>
  )
}
