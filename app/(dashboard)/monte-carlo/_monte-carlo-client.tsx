'use client'

// Consumer Monte Carlo experience.
// Supports profile-prefill simulation runs, historical run comparison, and
// advisor assumption accept/revert actions from consumer-safe API endpoints.

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { formatCurrency } from '@/lib/insurance'
import { DISCLAIMER_STRINGS } from '@/lib/compliance/language-policy'
import { displayPersonFirstName } from '@/lib/display-person-name'
import type { MonteCarloInputs, YearlyDataPoint } from '@/lib/monte-carlo'
import type { MonteCarloPrefillPayload } from '@/lib/monte-carlo/loadMonteCarloPrefill'
import type { MonteCarloAdvisorAssumptionsPayload } from '@/lib/monte-carlo/loadMonteCarloAdvisorAssumptions'
import {
  applyConsumerMCAssumptionsToInputs,
  CONSUMER_MC_ASSUMPTION_FIELDS,
  defaultConsumerMCAssumptions,
} from '@/lib/monte-carlo/applyConsumerAssumptionInputs'
import type { ConsumerMCAssumptionSet } from '@/lib/monte-carlo/consumerAssumptionScenarios'
import { MONTE_CARLO_SYSTEM_DEFAULTS } from '@/lib/calculations/monteCarlo'

interface SavedRun {
  id: string
  label?: string
  created_at: string
  success_rate: number
  median_balance: number
  worst_case_balance: number
  best_case_balance: number
  safe_withdrawal_rate: number
  percentile_10: YearlyDataPoint[]
  percentile_25: YearlyDataPoint[]
  percentile_50: YearlyDataPoint[]
  percentile_75: YearlyDataPoint[]
  percentile_90: YearlyDataPoint[]
  insight: string
  insight_boost: string
  current_age: number
  retirement_age: number
  annual_spending: number
  is_joint: boolean
  plan_end_age: number
}

type Step = 'portfolio' | 'spending' | 'assumptions' | 'review'
type Confidence = 'profile' | 'estimated' | 'missing'

interface PrefillSummary {
  profile_count: number
  estimated_count: number
  missing_count: number
  has_household: boolean
  has_spouse: boolean
  has_assets: boolean
  has_income: boolean
  has_expenses: boolean
}

interface AdvisorAssumptionScenario {
  id: string
  scenarioName: string | null
  sharedAt?: string | null
  acceptedAt?: string | null
  assumptions: {
    returnMeanPct: number
    volatilityPct: number
    withdrawalRatePct: number
    successThreshold: number
    simulationCount: number
    planningHorizonYr: number
    inflationRatePct: number
  }
}

const STEPS: { key: Step; label: string }[] = [
  { key: 'portfolio',   label: 'Portfolio' },
  { key: 'spending',    label: 'Spending' },
  { key: 'assumptions', label: 'Assumptions' },
  { key: 'review',      label: 'Review & Run' },
]

const EMPTY_INPUTS: MonteCarloInputs = {
  current_age:                 0,
  retirement_age:              65,
  life_expectancy:             90,
  birth_year:                  1980,
  has_spouse:                  false,
  p2_current_age:              0,
  p2_retirement_age:           65,
  p2_life_expectancy:          90,
  p2_birth_year:               1980,
  current_portfolio:           0,
  monthly_contribution:        0,
  stocks_pct:                  70,
  bonds_pct:                   20,
  cash_pct:                    10,
  annual_spending:             0,
  survivor_spending_pct:       75,
  social_security_monthly:     0,
  social_security_start_age:   67,
  p2_social_security_monthly:  0,
  p2_social_security_start_age: 67,
  other_income_annual:         0,
  inflation_rate:              2.5,
  simulation_count:            1000,
  include_rmd:                 true,
  spending_schedule:           [] as { age: number; amount: number }[],
}

function confidenceDot(c: Confidence | undefined) {
  if (c === 'profile')   return <span title="Pulled from your profile" className="text-green-500 text-xs ml-1">●</span>
  if (c === 'estimated') return <span title="Estimated from your profile" className="text-amber-400 text-xs ml-1">●</span>
  return <span title="Not found — please enter manually" className="text-red-400 text-xs ml-1">○</span>
}

function SuccessGauge({ rate }: { rate: number }) {
  const color = rate >= 90 ? '#22c55e' : rate >= 75 ? '#f59e0b' : rate >= 60 ? '#f97316' : '#ef4444'
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="10" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10" strokeDasharray={`${rate * 2.513} 251.3`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{rate}%</span>
          <span className="text-xs text-gray-500 text-center leading-tight">scenarios reached goal</span>
        </div>
      </div>
      <span className="text-xs text-gray-500 text-center max-w-[9rem]">of simulated scenarios reached your stated goal</span>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-xl font-bold text-gray-900">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

function Field({ label, hint, confidence, children }: { label: string; hint?: string; confidence?: Confidence; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700 flex items-center">
        {label}{confidence !== undefined && confidenceDot(confidence)}
      </label>
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
      {children}
    </div>
  )
}

const ChartSkeleton = () => (
  <div className="h-80 w-full animate-pulse rounded-xl bg-neutral-100" />
)

const FanChart = dynamic(
  () => import('@/components/monte-carlo/MonteCarloCharts').then((m) => ({ default: m.FanChart })),
  { ssr: false, loading: () => <ChartSkeleton /> },
)

const CompareMedianChart = dynamic(
  () => import('@/components/monte-carlo/MonteCarloCharts').then((m) => ({ default: m.CompareMedianChart })),
  { ssr: false, loading: () => <ChartSkeleton /> },
)

function NumInput({ value, onChange, prefix, step = 1000, min = 0 }: { value: number; onChange: (v: number) => void; prefix?: string; step?: number; min?: number }) {
  return (
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>}
      <input
        type="number"
        value={value || ''}
        min={min}
        step={step}
        placeholder="Enter value..."
        onChange={e => onChange(Number(e.target.value))}
        className={`w-full border border-gray-300 rounded-lg py-2 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--mwm-navy)] ${prefix ? 'pl-7' : 'pl-3'}`}
      />
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-l-2 border-[color:var(--mwm-navy)] pl-2 mb-3">
      <p className="text-xs font-semibold text-[color:var(--mwm-navy)] uppercase tracking-wide">{title}</p>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
  )
}


function AssumptionsDiff({ runA, runB }: { runA: SavedRun; runB: SavedRun }) {
  const labelA = runA.label || 'Run A'
  const labelB = runB.label || 'Run B'
  type Row = { label: string; a: string; b: string; diff: boolean; delta?: string; deltaPos?: boolean }
  const rows: Row[] = [
    { label: 'Scenarios Reached Goal', a: `${runA.success_rate}%`, b: `${runB.success_rate}%`, diff: runA.success_rate !== runB.success_rate, delta: `${runB.success_rate - runA.success_rate >= 0 ? '+' : ''}${runB.success_rate - runA.success_rate}%`, deltaPos: runB.success_rate >= runA.success_rate },
    { label: 'Median End Balance', a: formatCurrency(runA.median_balance), b: formatCurrency(runB.median_balance), diff: runA.median_balance !== runB.median_balance, delta: `${runB.median_balance >= runA.median_balance ? '+' : ''}${formatCurrency(runB.median_balance - runA.median_balance)}`, deltaPos: runB.median_balance >= runA.median_balance },
    { label: 'Worst Case', a: formatCurrency(runA.worst_case_balance), b: formatCurrency(runB.worst_case_balance), diff: runA.worst_case_balance !== runB.worst_case_balance, delta: `${runB.worst_case_balance >= runA.worst_case_balance ? '+' : ''}${formatCurrency(runB.worst_case_balance - runA.worst_case_balance)}`, deltaPos: runB.worst_case_balance >= runA.worst_case_balance },
    { label: 'Withdrawal Rate', a: `${runA.safe_withdrawal_rate}%`, b: `${runB.safe_withdrawal_rate}%`, diff: runA.safe_withdrawal_rate !== runB.safe_withdrawal_rate },
    { label: 'Retirement Age', a: String(runA.retirement_age), b: String(runB.retirement_age), diff: runA.retirement_age !== runB.retirement_age },
    { label: 'Annual Spending', a: formatCurrency(runA.annual_spending), b: formatCurrency(runB.annual_spending), diff: runA.annual_spending !== runB.annual_spending },
    { label: 'Plan End Age', a: String(runA.plan_end_age), b: String(runB.plan_end_age), diff: runA.plan_end_age !== runB.plan_end_age },
    { label: 'Plan Type', a: runA.is_joint ? 'Joint' : 'Individual', b: runB.is_joint ? 'Joint' : 'Individual', diff: runA.is_joint !== runB.is_joint },
  ]
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 uppercase tracking-wide w-44">Metric</th>
            <th className="text-right py-2 px-4 text-xs font-medium text-[color:var(--mwm-navy)] uppercase tracking-wide">{labelA}</th>
            <th className="text-right py-2 px-4 text-xs font-medium text-amber-600 uppercase tracking-wide">{labelB}</th>
            <th className="text-right py-2 pl-4 text-xs font-medium text-gray-500 uppercase tracking-wide w-24">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(row => (
            <tr key={row.label} className={row.diff ? 'bg-amber-50/40' : ''}>
              <td className="py-2.5 pr-4 text-gray-600 font-medium">{row.label}</td>
              <td className="py-2.5 px-4 text-right font-semibold text-[color:var(--mwm-navy)]">{row.a}</td>
              <td className="py-2.5 px-4 text-right font-semibold text-amber-700">{row.b}</td>
              <td className="py-2.5 pl-4 text-right text-xs">
                {row.delta
                  ? <span className={row.deltaPos ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>{row.delta}</span>
                  : row.diff ? <span className="text-amber-600">different</span> : <span className="text-gray-300">same</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CompareView({ history, compareA, compareB, setCompareA, setCompareB }: { history: SavedRun[]; compareA: SavedRun | null; compareB: SavedRun | null; setCompareA: (r: SavedRun | null) => void; setCompareB: (r: SavedRun | null) => void }) {
  if (history.length < 2) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center space-y-2">
        <p className="text-3xl">📊</p>
        <p className="text-gray-600 text-sm font-medium">You need at least 2 saved runs to compare</p>
        <p className="text-gray-400 text-xs">Run a simulation, label it, then run another with different assumptions.</p>
      </div>
    )
  }
  const runA = compareA ?? history[0]
  const runB = compareB ?? history[1]
  const labelA = runA.label || 'Run A'
  const labelB = runB.label || 'Run B'
  const successDiff = runB.success_rate - runA.success_rate
  const balanceDiff = runB.median_balance - runA.median_balance
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-semiboltext-gray-500 uppercase tracking-wide mb-3">Select runs to compare</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[color:var(--mwm-navy)] mb-1.5">Run A (indigo)</label>
            <select value={runA.id} onChange={e => setCompareA(history.find(r => r.id === e.target.value) ?? null)} className="w-full border border-[color:var(--mwm-border)] rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--mwm-navy)]">
              {history.map(r => <option key={r.id} value={r.id}>{r.label || 'Unnamed'} — {r.success_rate}% · {new Date(r.created_at).toLocaleDateString()}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-amber-600 mb-1.5">Run B (amber)</label>
            <select value={runB.id} onChange={e => setCompareB(history.find(r => r.id === e.target.value) ?? null)} className="w-full border border-amber-200 rounded-lg py-2 px-3 text-sm focus:outlinone focus:ring-2 focus:ring-amber-400">
              {history.map(r => <option key={r.id} value={r.id}>{r.label || 'Unnamed'} — {r.success_rate}% · {new Date(r.created_at).toLocaleDateString()}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[color:var(--mwm-border)] p-5 flex flex-col items-center gap-2">
          <p className="text-xs font-semibold text-[color:var(--mwm-navy)] uppercase tracking-wide">{labelA}</p>
          <SuccessGauge rate={runA.success_rate} />
          <p className="text-xs text-gray-400 text-center">{runA.is_joint ? 'Joint' : 'Individual'} through age {runA.plan_end_age}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-100 p-5 flex flex-col items-center gap-2">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">{labelB}</p>
          <SuccessGauge rate={runB.success_rate} />
          <p className="text-xext-gray-400 text-center">{runB.is_joint ? 'Joint' : 'Individual'} through age {runB.plan_end_age}</p>
        </div>
      </div>
      {runA.id !== runB.id && (
        <div className={`rounded-xl border p-4 text-sm ${successDiff > 0 ? 'bg-green-50 border-green-200 text-green-800' : successDiff < 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
          <span className="font-semibold">{labelB}</span> had <span className="font-bold">{Math.abs(successDiff)}% {successDiff >= 0 ? 'more' : 'fewer'} scenarios reach your stated goal</span> and a <span className="font-bold">{balanceDiff >= 0 ? '+' : ''}{formatCurrency(balanceDiff)} median end balance</span> compared to <span className="font-semibold">{labelA}</span>.
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Median Portfolio Trajectory</h3>
        <CompareMedianChart runA={runA} runB={runB} />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Metrics and Assumptions</h3>
        <AssumptionsDiff runA={runA} runB={runB} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[var(--mwm-gold-pale)] border border-[color:var(--mwm-border)] rounded-xl p-4">
          <p className="text-xs font-semibold text-[color:var(--mwm-navy)] uppercase tracking-wide mb-2">{labelA} Analysis</p>
          <p className="text-sm text-[color:var(--mwm-navy)]">{runA.insight}</p>
          <p className="text-sm text-[color:var(--mwm-navy)] mt-1">{runA.insight_boost}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">{labelB} Analysis</p>
          <p className="text-sm text-amber-800">{runB.insight}</p>
          <p className="text-sm text-amber-700 mt-1">{runB.insight_boost}</p>
        </div>
      </div>
    </div>
  )
}

function applyPrefillToInputs(
  inputs: MonteCarloInputs,
  prefillData: MonteCarloPrefillPayload,
): MonteCarloInputs {
  const p = prefillData.prefill
  return {
    ...inputs,
    birth_year: p.birth_year ?? inputs.birth_year,
    current_age: p.current_age ?? inputs.current_age,
    retirement_age: p.retirement_age ?? inputs.retirement_age,
    life_expectancy: p.life_expectancy ?? inputs.life_expectancy,
    inflation_rate: p.inflation_rate ?? inputs.inflation_rate,
    social_security_monthly: p.social_security_monthly ?? inputs.social_security_monthly,
    social_security_start_age: p.social_security_start_age ?? inputs.social_security_start_age,
    has_spouse: p.has_spouse ?? inputs.has_spouse,
    p2_birth_year: p.p2_birth_year ?? inputs.p2_birth_year,
    p2_current_age: p.p2_current_age ?? inputs.p2_current_age,
    p2_retirement_age: p.p2_retirement_age ?? inputs.p2_retirement_age,
    p2_life_expectancy: p.p2_life_expectancy ?? inputs.p2_life_expectancy,
    p2_social_security_monthly: p.p2_social_security_monthly ?? inputs.p2_social_security_monthly,
    p2_social_security_start_age:
      p.p2_social_security_start_age ?? inputs.p2_social_security_start_age,
    current_portfolio: p.current_portfolio ?? inputs.current_portfolio,
    monthly_contribution: p.monthly_contribution ?? inputs.monthly_contribution,
    stocks_pct: p.stocks_pct ?? inputs.stocks_pct,
    bonds_pct: p.bonds_pct ?? inputs.bonds_pct,
    cash_pct: p.cash_pct ?? inputs.cash_pct,
    other_income_annual: p.other_income_annual ?? inputs.other_income_annual,
    annual_spending: p.annual_spending ?? inputs.annual_spending,
    survivor_spending_pct: p.survivor_spending_pct ?? inputs.survivor_spending_pct,
  }
}

function applyAdvisorAssumptionsToInputs(
  inputs: MonteCarloInputs,
  advisorData: MonteCarloAdvisorAssumptionsPayload | null,
): { inputs: MonteCarloInputs; assumptions: ConsumerMCAssumptionSet } {
  const accepted = advisorData?.acceptedScenario
  const assumptions = accepted?.assumptions
    ? { ...accepted.assumptions }
    : defaultConsumerMCAssumptions()
  return {
    inputs: applyConsumerMCAssumptionsToInputs(inputs, accepted?.assumptions ?? null),
    assumptions,
  }
}

function stripConsumerAssumptionOverrides(inputs: MonteCarloInputs): MonteCarloInputs {
  const next = { ...inputs }
  delete next.portfolio_return_mean_pct
  delete next.portfolio_return_volatility_pct
  delete next.mc_success_threshold_pct
  delete next.mc_withdrawal_rate_pct
  return next
}

function buildInitialMonteCarloState(
  initialPrefill: MonteCarloPrefillPayload | null,
  initialAdvisorAssumptions: MonteCarloAdvisorAssumptionsPayload | null,
) {
  let inputs = { ...EMPTY_INPUTS }
  if (initialPrefill?.prefill) {
    inputs = applyPrefillToInputs(inputs, initialPrefill)
  }
  const { inputs: withAssumptions, assumptions } = applyAdvisorAssumptionsToInputs(
    inputs,
    initialAdvisorAssumptions,
  )

  return {
    inputs: withAssumptions,
    mcAssumptions: assumptions,
    baselineHorizons: {
      p1: inputs.life_expectancy,
      p2: inputs.p2_life_expectancy,
    },
    confidence: (initialPrefill?.confidence ?? {}) as Record<string, Confidence>,
    summary: initialPrefill?.summary ?? null,
    p1Name: initialPrefill?.person1_name
      ? displayPersonFirstName(initialPrefill.person1_name, 'Person 1')
      : 'Person 1',
    p2Name: initialPrefill?.person2_name
      ? displayPersonFirstName(initialPrefill.person2_name, 'Person 2')
      : 'Person 2',
    acceptedAdvisorScenario: initialAdvisorAssumptions?.acceptedScenario ?? null,
    latestSharedAdvisorScenario: initialAdvisorAssumptions?.latestSharedScenario ?? null,
  }
}

export function MonteCarloClient({
  initialPrefill = null,
  initialHistory = null,
  initialAdvisorAssumptions = null,
}: {
  initialPrefill?: MonteCarloPrefillPayload | null
  initialHistory?: SavedRun[] | null
  initialAdvisorAssumptions?: MonteCarloAdvisorAssumptionsPayload | null
}) {
  const initialState = buildInitialMonteCarloState(initialPrefill, initialAdvisorAssumptions)

  const [step, setStep]             = useState<Step>('portfolio')
  const [inputs, setInputs]         = useState<MonteCarloInputs>(initialState.inputs)
  const [mcAssumptions, setMcAssumptions] = useState<ConsumerMCAssumptionSet>(initialState.mcAssumptions)
  const [baselineHorizons, setBaselineHorizons] = useState(initialState.baselineHorizons)
  const [confidence, setConfidence] = useState<Record<string, Confidence>>(initialState.confidence)
  const [summary, setSummary]       = useState<PrefillSummary | null>(initialState.summary)
  const [result, setResult]         = useState<SavedRun | null>(null)
  const [history, setHistory]       = useState<SavedRun[]>(initialHistory ?? [])
  const [loading, setLoading]       = useState(false)
  const [prefilling, setPrefilling] = useState(initialPrefill === null)
  const [error, setError]           = useState<string | null>(null)
  const [label, setLabel]           = useState('')
  const [p1Name, setP1Name]         = useState(initialState.p1Name)
  const [p2Name, setP2Name]         = useState(initialState.p2Name)
  const [acceptedAdvisorScenario, setAcceptedAdvisorScenario] = useState<AdvisorAssumptionScenario | null>(
    initialState.acceptedAdvisorScenario,
  )
  const [latestSharedAdvisorScenario, setLatestSharedAdvisorScenario] = useState<AdvisorAssumptionScenario | null>(
    initialState.latestSharedAdvisorScenario,
  )
  const [assumptionActionLoading, setAssumptionActionLoading] = useState(false)

  const [activeTab, setActiveTab] = useState<'simulate' | 'compare'>('simulate')
  const [compareA, setCompareA] = useState<SavedRun | null>(null)
  const [compareB, setCompareB] = useState<SavedRun | null>(null)

  const set = (k: keyof MonteCarloInputs, v: number | boolean) =>
    setInputs(prev => ({ ...prev, [k]: v }))

  const setAssumption = (key: keyof ConsumerMCAssumptionSet, value: number) =>
    setMcAssumptions(prev => ({ ...prev, [key]: value }))

  const simulationInputs = applyConsumerMCAssumptionsToInputs(inputs, mcAssumptions)

  const allocationTotal = inputs.stocks_pct + inputs.bonds_pct + inputs.cash_pct
  const allocationValid = allocationTotal === 100

  const missingCritical = ['current_age', 'current_portfolio', 'annual_spending'].filter(k => confidence[k] === 'missing' || !inputs[k as keyof MonteCarloInputs])

  useEffect(() => {
    if (initialPrefill !== null && initialHistory !== null) return

    Promise.all([
      initialPrefill === null
        ? fetch('/api/monte-carlo/prefill').then((r) => r.json())
        : Promise.resolve(initialPrefill),
      initialHistory === null
        ? fetch('/api/monte-carlo').then((r) => r.json())
        : Promise.resolve(initialHistory),
    ])
      .then(([prefillData, historyData]) => {
        if (prefillData?.prefill) {
          setInputs((prev) => applyPrefillToInputs(prev, prefillData))
          if (prefillData.person1_name) {
            setP1Name(displayPersonFirstName(prefillData.person1_name, 'Person 1'))
          }
          if (prefillData.person2_name) {
            setP2Name(displayPersonFirstName(prefillData.person2_name, 'Person 2'))
          }
          setConfidence(prefillData.confidence ?? {})
          setSummary(prefillData.summary ?? null)
          const prefillInputs = applyPrefillToInputs({ ...EMPTY_INPUTS }, prefillData)
          setBaselineHorizons({
            p1: prefillInputs.life_expectancy,
            p2: prefillInputs.p2_life_expectancy,
          })
        }
        if (Array.isArray(historyData)) setHistory(historyData)
        setPrefilling(false)
      })
      .catch(() => setPrefilling(false))
  }, [initialPrefill, initialHistory])

  useEffect(() => {
    if (initialAdvisorAssumptions !== null) return

    fetch('/api/monte-carlo/advisor-assumptions')
      .then((r) => r.json())
      .then((data) => {
        const accepted = data?.acceptedScenario ?? null
        const shared = data?.latestSharedScenario ?? null
        setAcceptedAdvisorScenario(accepted)
        setLatestSharedAdvisorScenario(shared)
        if (accepted?.assumptions) {
          setMcAssumptions({ ...accepted.assumptions })
          setInputs((prev) => applyConsumerMCAssumptionsToInputs(prev, accepted.assumptions))
        }
      })
      .catch(() => null)
  }, [initialAdvisorAssumptions])

  async function acceptAdvisorAssumptions() {
    if (!latestSharedAdvisorScenario?.id) return
    setAssumptionActionLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/monte-carlo/advisor-assumptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', scenarioId: latestSharedAdvisorScenario.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Unable to accept advisor assumptions')
      const accepted = data?.acceptedScenario ?? null
      setAcceptedAdvisorScenario(accepted)
      if (accepted?.assumptions) {
        setMcAssumptions({ ...accepted.assumptions })
        setInputs((prev) => applyConsumerMCAssumptionsToInputs(prev, accepted.assumptions))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to accept advisor assumptions')
    } finally {
      setAssumptionActionLoading(false)
    }
  }

  async function revertAdvisorAssumptions() {
    setAssumptionActionLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/monte-carlo/advisor-assumptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revert' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Unable to revert assumptions')
      setAcceptedAdvisorScenario(null)
      const defaults = data?.systemDefaults ?? MONTE_CARLO_SYSTEM_DEFAULTS
      setMcAssumptions({ ...defaults })
      setInputs((prev) => ({
        ...stripConsumerAssumptionOverrides(prev),
        inflation_rate: Number(defaults.inflationRatePct),
        simulation_count: Number(defaults.simulationCount),
        life_expectancy: baselineHorizons.p1,
        p2_life_expectancy: baselineHorizons.p2,
      }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to revert assumptions')
    } finally {
      setAssumptionActionLoading(false)
    }
  }

  async function runSimulation() {
    if (!allocationValid) { setError('Allocation must sum to 100%'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/monte-carlo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...simulationInputs, label }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
      setHistory(prev => [data, ...prev])
      setStep('portfolio')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Simulation failed')
    } finally {
      setLoading(false)
    }
  }

  async function deleteRun(id: string) {
    await fetch(`/api/monte-carlo/${id}`, { method: 'DELETE' })
    setHistory(prev => prev.filter(r => r.id !== id))
    if (result?.id === id) setResult(null)
    if (compareA?.id === id) setCompareA(null)
    if (compareB?.id === id) setCompareB(null)
  }

  const stepIdx = STEPS.findIndex(s => s.key === step)

  if (prefilling) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 flex items-center justify-center h-64 text-gray-400 text-sm gap-3">
        <div className="w-6 h-6 border-2 border-[color:var(--mwm-border)] border-t-[color:var(--mwm-navy)] rounded-full animate-spin" />
        <p>Loading your profile data...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--mwm-navy)]">Monte Carlo Simulations</h1>
          <p className="text-gray-500 mt-1">Probabilistic retirement modeling across 1,000+ market scenarios</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 shrink-0 mt-1">
          <button onClick={() => setActiveTab('simulate')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'simulate' ? 'bg-white shadow text-[color:var(--mwm-navy)]' : 'text-gray-500 hover:text-gray-700'}`}>Simulate</button>
          <button onClick={() => setActiveTab('compare')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'compare' ? 'bg-white shadow text-[color:var(--mwm-navy)]' : 'text-gray-500 hover:text-gray-700'}`}>Compare {history.length >= 2 ? `(${history.length})` : ''}</button>
        </div>
      </div>

      {latestSharedAdvisorScenario && !acceptedAdvisorScenario && (
        <div className="rounded-xl border border-[color:var(--mwm-border)] bg-[var(--mwm-gold-pale)] p-4">
          <p className="text-sm font-semibold text-[color:var(--mwm-navy)]">
            Advisor assumptions available: {latestSharedAdvisorScenario.scenarioName}
          </p>
          <p className="mt-1 text-xs text-[color:var(--mwm-navy)]">
            Accept to apply all advisor Monte Carlo assumptions (returns, volatility, withdrawal rate, success goal, simulations, planning horizon, and inflation).
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={acceptAdvisorAssumptions}
              disabled={assumptionActionLoading}
              className="rounded bg-[var(--mwm-navy)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              {assumptionActionLoading ? 'Applying…' : 'Accept advisor assumptions'}
            </button>
          </div>
        </div>
      )}

      {acceptedAdvisorScenario && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-semibold text-green-900">
            Using accepted advisor assumptions: {acceptedAdvisorScenario.scenarioName}
          </p>
          <p className="mt-1 text-xs text-green-700">
            Applied advisor assumptions: return model, volatility, withdrawal rate, success goal, simulation count, planning horizon, and inflation.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={revertAdvisorAssumptions}
              disabled={assumptionActionLoading}
              className="rounded border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-800 disabled:opacity-60"
            >
              {assumptionActionLoading ? 'Reverting…' : 'Revert to system defaults'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'compare' && (
        <CompareView history={history} compareA={compareA} compareB={compareB} setCompareA={setCompareA} setCompareB={setCompareB} />
      )}

      {activeTab === 'simulate' && (
      <>
      {summary && (
        <div className="rounded-xl border p-4 space-y-2 bg-[var(--mwm-gold-pale)] border-[color:var(--mwm-border)]">
          <p className="text-sm font-semibold text-[color:var(--mwm-navy)]">We pre-filled what we could from your profile</p>
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1 text-green-700"><span className="text-green-500">●</span> {summary.profile_count} pulled from profile</span>
            <span className="flex items-center gap-1 text-amber-700"><span className="text-amber-400">●</span> {summary.estimated_count} estimated</span>
            <span className="flex items-center gap-1 text-red-600"><span className="text-red-400">○</span> {summary.missing_count} need your input</span>
          </div>
          {!summary.has_household && (
            <p className="text-xs text-[color:var(--mwm-navy)]">Tip: Complete your <a href="/profile" className="underline font-medium">Profile</a> to auto-fill age, retirement age, and Social Security estimates.</p>
          )}
          {!summary.has_assets && (
            <p className="text-xs text-[color:var(--mwm-navy)]">Tip: Add entries in <a href="/assets" className="underline font-medium">Assets</a> to auto-fill your portfolio balance.</p>
          )}
          {!summary.has_expenses && (
            <p className="text-xs text-[color:var(--mwm-navy)]">Tip: Add entries in <a href="/expenses" className="underline font-medium">Expenses</a> to auto-fill your retirement spending estimate.</p>
          )}
        </div>
      )}

      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex flex-1 items-center">
                <button
                  type="button"
                  onClick={() => setStep(s.key)}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                      step === s.key
                        ? 'bg-[var(--mwm-navy)] text-white'
                        : stepIdx > i
                          ? 'bg-[var(--mwm-gold-pale)] text-[color:var(--mwm-navy)]'
                          : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {stepIdx > i ? '✓' : i + 1}
                  </div>
                  <span
                    className={`text-[10px] font-medium leading-none ${
                      step === s.key ? 'text-[color:var(--mwm-navy)]' : 'text-gray-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className={`mx-1 mb-4 h-px flex-1 ${
                      stepIdx > i ? 'bg-[var(--mwm-gold-pale)]' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {step === 'portfolio' && (
            <div className="space-y-4">
              <SectionHeader title={p1Name} />
              <Field label="Current Age" confidence={confidence.current_age}>
                <NumInput value={inputs.current_age} onChange={v => set('current_age', v)} step={1} />
              </Field>
              <Field label="Retirement Age" confidence={confidence.retirement_age}>
                <NumInput value={inputs.retirement_age} onChange={v => set('retirement_age', v)} step={1} />
              </Field>
              <Field label="Life Expectancy" confidence={confidence.life_expectancy}>
                <NumInput value={inputs.life_expectancy} onChange={v => set('life_expectancy', v)} step={1} />
              </Field>

              {inputs.has_spouse && (
                <>
                  <SectionHeader title={`${p2Name} (Spouse)`} />
                  <Field label="Spouse Current Age" confidence={confidence.p2_current_age}>
                    <NumInput value={inputs.p2_current_age} onChange={v => set('p2_current_age', v)} step={1} />
                  </Field>
                  <Field label="Spouse Retirement Age" confidence={confidence.p2_retirement_age}>
                    <NumInput value={inputs.p2_retirement_age} onChange={v => set('p2_retirement_age', v)} step={1} />
                  </Field>
                  <Field label="Spouse Life Expectancy" confidence={confidence.p2_life_expectancy}>
                    <NumInput value={inputs.p2_life_expectancy} onChange={v => set('p2_life_expectancy', v)} step={1} />
                  </Field>
                </>
              )}

              <SectionHeader title="Portfolio" />
              <Field label="Current Portfolio" hint="Total investable assets" confidence={confidence.current_portfolio}>
                <NumInput value={inputs.current_portfolio} onChange={v => set('current_portfolio', v)} prefix="$" />
              </Field>
              <Field label="Monthly Contribution" confidence={confidence.monthly_contribution}>
                <NumInput value={inputs.monthly_contribution} onChange={v => set('monthly_contribution', v)} prefix="$" step={100} />
              </Field>
              <Field label="Stocks %" hint={`Total: ${allocationTotal}% ${allocationValid ? 'OK' : '— must equal 100'}`} confidence={confidence.stocks_pct}>
                <NumInput value={inputs.stocks_pct} onChange={v => set('stocks_pct', v)} step={5} />
              </Field>
              <Field label="Bonds %" confidence={confidence.bonds_pct}>
                <NumInput value={inputs.bonds_pct} onChange={v => set('bonds_pct', v)} step={5} />
              </Field>
              <Field label="Cash %" confidence={confidence.cash_pct}>
                <NumInput value={inputs.cash_pct} onChange={v => set('cash_pct', v)} step={5} />
              </Field>
              <button onClick={() => setStep('spending')} className="w-full bg-[var(--mwm-navy)] text-white rounded-lg py-2 text-sm font-medium hover:bg-[var(--mwm-navy-light)]">Next</button>
            </div>
          )}

          {step === 'spending' && (
            <div className="space-y-4">
              <SectionHeader title="Household Spending" />
              <Field label="Annual Retirement Spending" hint="In today's dollars — full household" confidence={confidence.annual_spending}>
                <NumInput value={inputs.annual_spending} onChange={v => set('annual_spending', v)} prefix="$" />
              </Field>
              {inputs.has_spouse && (
                <Field label="Survivor Spending" hint="% of spending if one spouse passes">
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min={50} max={100} step={5}
                      value={inputs.survivor_spending_pct}
                      onChange={e => set('survivor_spending_pct', Number(e.target.value))}
                      className="flex-1 accent-[var(--mwm-navy)]"
                    />
                    <span className="text-sm font-medium w-10 text-right">{inputs.survivor_spending_pct}%</span>
                  </div>
                  <p className="text-xs text-gray-400">Industry standard is 70-80% of joint spending</p>
                </Field>
              )}

              <SectionHeader title="Spending Schedule (optional)" />
              <div className="space-y-3">
                <div className="rounded-lg bg-[var(--mwm-gold-pale)] border border-[color:var(--mwm-border)] px-3 py-2.5">
                  <p className="text-xs font-medium text-[color:var(--mwm-navy)] mb-1">How spending schedules work</p>
                  <p className="text-xs text-[color:var(--mwm-navy)] leading-relaxed">Your base spending above applies from retirement onward. Use the schedule below to model years where your run rate changes — for example when a mortgage is paid off, children finish college, or healthcare costs rise. For each entry, select the age at which the change takes effect and enter your new total annual household spending from that point forward.</p>
                </div>
                {(inputs.spending_schedule ?? []).length === 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-dashed border-gray-200 text-xs text-gray-400">
                    <span className="w-20">e.g. age 72</span>
                    <span className="flex-1">e.g. $120,000 (mortgage paid off)</span>
                    <span className="text-gray-300 text-xs">← example only</span>
                  </div>
                )}
                {(inputs.spending_schedule ?? []).map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16 shrink-0">From age</span>
                    <input
                      type="number" min={inputs.retirement_age} max={inputs.life_expectancy}
                      value={entry.age}
                      onChange={e => {
                        const updated = [...(inputs.spending_schedule ?? [])]
                        updated[idx] = { ...updated[idx], age: Number(e.target.value) }
                        setInputs(prev => ({ ...prev, spending_schedule: updated }))
                      }}
                      className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-center"
                    />
                    <span className="text-xs text-gray-500 shrink-0">spend</span>
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number" min={0} step={1}
                        value={entry.amount}
                        onChange={e => {
                          const updated = [...(inputs.spending_schedule ?? [])]
                          updated[idx] = { ...updated[idx], amount: Number(e.target.value) }
                          setInputs(prev => ({ ...prev, spending_schedule: updated }))
                        }}
                        className="w-full rounded border border-gray-300 pl-6 pr-2 py-1 text-sm"
                        placeholder="Annual amount"
                      />
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">/yr</span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (inputs.spending_schedule ?? []).filter((_, i) => i !== idx)
                        setInputs(prev => ({ ...prev, spending_schedule: updated }))
                      }}
                      className="text-red-400 hover:text-red-600 text-sm font-medium px-1"
                    >×</button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const existing = inputs.spending_schedule ?? []
                    const lastAge = existing.length > 0 ? existing[existing.length - 1].age + 5 : (inputs.retirement_age + 5)
                    setInputs(prev => ({ ...prev, spending_schedule: [...existing, { age: lastAge, amount: inputs.annual_spending }] }))
                  }}
                  className="text-[color:var(--mwm-navy)] hover:text-[color:var(--mwm-navy)] text-sm font-medium"
                >+ Add spending change</button>
              </div>
              <SectionHeader title={`${p1Name} — Social Security`} />
              <Field label="Monthly SS Benefit" confidence={confidence.social_security_monthly}>
                <NumInput value={inputs.social_security_monthly} onChange={v => set('social_security_monthly', v)} prefix="$" step={100} />
              </Field>
              <Field label="SS Claiming Age" confidence={confidence.social_security_start_age}>
                <NumInput value={inputs.social_security_start_age} onChange={v => set('social_security_start_age', v)} step={1} min={62} />
              </Field>

              {inputs.has_spouse && (
                <>
                  <SectionHeader title={`${p2Name} — Social Security`} subtitle="Survivor keeps the higher of the two benefits" />
                  <Field label="Spouse Monthly SS Benefit" confidence={confidence.p2_social_security_monthly}>
                    <NumInput value={inputs.p2_social_security_monthly} onChange={v => set('p2_social_security_monthly', v)} prefix="$" step={100} />
                  </Field>
                  <Field label="Spouse SS Claiming Age" confidence={confidence.p2_social_security_start_age}>
                    <NumInput value={inputs.p2_social_security_start_age} onChange={v => set('p2_social_security_start_age', v)} step={1} min={62} />
                  </Field>
                </>
              )}

              <SectionHeader title="Other Income" />
              <Field label="Other Annual Income" hint="Pension, rental, part-time" confidence={confidence.other_income_annual}>
                <NumInput value={inputs.other_income_annual} onChange={v => set('other_income_annual', v)} prefix="$" />
              </Field>
              <div className="flex gap-2">
                <button onClick={() => setStep('portfolio')} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Back</button>
                <button onClick={() => setStep('assumptions')} className="flex-1 bg-[var(--mwm-navy)] text-white rounded-lg py-2 text-sm font-medium hover:bg-[var(--mwm-navy-light)]">Next</button>
              </div>
            </div>
          )}

          {step === 'assumptions' && (
            <div className="space-y-4">
              {CONSUMER_MC_ASSUMPTION_FIELDS.map((field) => (
                <Field
                  key={field.key}
                  label={field.label}
                  hint={field.hint}
                  confidence={field.key === 'inflationRatePct' ? confidence.inflation_rate : undefined}
                >
                  {field.key === 'simulationCount' ? (
                    <select
                      value={mcAssumptions.simulationCount}
                      onChange={e => setAssumption('simulationCount', Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--mwm-navy)]"
                    >
                      <option value={500}>500 — Fast</option>
                      <option value={1000}>1,000 — Balanced</option>
                      <option value={5000}>5,000 — Precise</option>
                      <option value={10000}>10,000 — Maximum</option>
                    </select>
                  ) : (
                    <NumInput
                      value={mcAssumptions[field.key]}
                      onChange={v => setAssumption(field.key, v)}
                      step={field.step}
                      min={field.min}
                    />
                  )}
                </Field>
              ))}
              <Field label="Include RMDs" hint="SECURE 2.0: age 73 if born before 1960, age 75 if born 1960 or later">
                <div className="flex items-center gap-2 mt-1">
                  <input type="checkbox" checked={inputs.include_rmd} onChange={e => set('include_rmd', e.target.checked)} className="w-4 h-4 accent-[var(--mwm-navy)]" />
                  <span className="text-sm text-gray-600">Factor in RMDs per SECURE 2.0</span>
                </div>
              </Field>
              <div className="flex gap-2">
                <button onClick={() => setStep('spending')} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Back</button>
                <button onClick={() => setStep('review')} className="flex-1 bg-[var(--mwm-navy)] text-white rounded-lg py-2 text-sm font-medium hover:bg-[var(--mwm-navy-light)]">Next</button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {missingCritical.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1">Review before running</p>
                  <ul className="text-xs text-amber-700 space-y-0.5">
                    {missingCritical.includes('current_age') && <li>○ Current age is missing — go to step 1</li>}
                    {missingCritical.includes('current_portfolio') && <li>○ Portfolio balance is missing — go to step 1</li>}
                    {missingCritical.includes('annual_spending') && <li>○ Annual spending is missing — go to step 2</li>}
                  </ul>
                </div>
              )}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Plan type</span><span className="font-medium">{inputs.has_spouse ? 'Joint (2 people)' : 'Individual'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Person 1 age</span><span className="font-medium">{inputs.current_age} → retire at {inputs.retirement_age}</span></div>
                {inputs.has_spouse && <div className="flex justify-between"><span className="text-gray-500">Person 2 age</span><span className="font-medium">{inputs.p2_current_age} → retire at {inputs.p2_retirement_age}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">Portfolio</span><span className="font-medium">{formatCurrency(inputs.current_portfolio)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Monthly contribution</span><span className="font-medium">{formatCurrency(inputs.monthly_contribution)}/mo</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Allocation</span><span className="font-medium">{inputs.stocks_pct}% / {inputs.bonds_pct}% / {inputs.cash_pct}%</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Annual spending</span><span className="font-medium">{formatCurrency(inputs.annual_spending)}</span></div>
                {inputs.has_spouse && <div className="flex justify-between"><span className="text-gray-500">Survivor spending</span><span className="font-medium">{inputs.survivor_spending_pct}% of joint</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">P1 Social Security</span><span className="font-medium">{formatCurrency(inputs.social_security_monthly)}/mo at {inputs.social_security_start_age}</span></div>
                {inputs.has_spouse && <div className="flex justify-between"><span className="text-gray-500">P2 Social Security</span><span className="font-medium">{formatCurrency(inputs.p2_social_security_monthly)}/mo at {inputs.p2_social_security_start_age}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">Plan horizon</span><span className="font-medium">Through age {simulationInputs.life_expectancy}{inputs.has_spouse ? ` / ${simulationInputs.p2_life_expectancy}` : ''}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Return model</span><span className="font-medium">{mcAssumptions.returnMeanPct}% ± {mcAssumptions.volatilityPct}%</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Success goal</span><span className="font-medium">{mcAssumptions.successThreshold}% of runs</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Target withdrawal rate</span><span className="font-medium">{mcAssumptions.withdrawalRatePct}%</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Inflation</span><span className="font-medium">{mcAssumptions.inflationRatePct}%</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Simulations</span><span className="font-medium">{mcAssumptions.simulationCount.toLocaleString()}</span></div>
              </div>
              <div className="text-xs text-gray-400 flex flex-wrap gap-3">
                <span className="flex items-center gap-1"><span className="text-green-500">●</span> From your profile</span>
                <span className="flex items-center gap-1"><span className="text-amber-400">●</span> Estimated</span>
                <span className="flex items-center gap-1"><span className="text-red-400">○</span> Manual eneded</span>
              </div>
              <Field label="Label this run (optional)">
                <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Base case, Early retirement..." className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--mwm-navy)]" />
              </Field>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => setStep('assumptions')} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Back</button>
                <button onClick={runSimulation} disabled={loading || !allocationValid} className="flex-1 bg-[var(--mwm-navy)] text-white rounded-lg py-2 text-sm font-medium hover:bg-[var(--mwm-navy-light)] disabled:opacity-50">
                  {loading ? 'Running...' : 'Run Simulation'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-sm gap-3">
              <div className="w-10 h-10 border-4 border-[color:var(--mwm-border)] border-t-[color:var(--mwm-navy)] rounded-full animate-spin" />
              <p>Running {simulationInputs.simulation_count.toLocaleString()} simulations...</p>
            </div>
          )}
          {result && !loading && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {result.is_joint ? 'Joint Retirement Plan' : 'Retirement Plan'} — Plan through age {result.plan_end_age}
                  </h3>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <SuccessGauge rate={result.success_rate} />
                  <div className="grid grid-cols-2 gap-3 flex-1 w-full">
                    <StatCard label="Median Balance at End" value={formatCurrency(result.median_balance)} />
                    <StatCard label="Withdrawal Rate" value={`${result.safe_withdrawal_rate}%`} sub="of retirement portfolio" />
                    <StatCard label="Best Case" value={formatCurrency(result.best_case_balance ?? 0)} sub="90th percentile" />
                    <StatCard label="Worst Case" value={formatCurrency(result.worst_case_balance ?? 0)} sub="10th percentile" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-4">{DISCLAIMER_STRINGS.monteCarlo}</p>
              </div>
              <div className="bg-[var(--mwm-gold-pale)] border border-[color:var(--mwm-border)] rounded-xl p-4 space-y-1">
                <p className="text-sm font-semibold text-[color:var(--mwm-navy)]">Analysis</p>
                <p className="text-sm text-[color:var(--mwm-navy)]">{result.insight}</p>
                <p className="text-sm text-[color:var(--mwm-navy)] mt-1">{result.insight_boost}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Portfolio Outcome Range</h3>
                <FanChart run={result} />
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
                  {['90th pct', '75th pct', 'Median', '25th pct', '10th pct'].map(l => (
                    <span key={l} className="flex items-center gap-1">
                      <span className="w-3 h-0.5 bg-[var(--mwm-navy-light)] inline-block" />{l}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Saved Runs</h3>
          <div className="space-y-2">
            {history.map(run => (
              <div key={run.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setResult(run)}>
                <div>
                  <p className="text-sm font-medium text-gray-800">{run.label || 'Unnamed run'}</p>
                  <p className="text-xs text-gray-400">{new Date(run.created_at).toLocaleDateString()} {run.is_joint ? '· Joint plan' : '· Individual'}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-sm font-semibold ${run.success_rate >= 90 ? 'text-green-600' : run.success_rate >= 75 ? 'text-amber-600' : 'texted-500'}`}>
                    {run.success_rate}% reached goal
                  </span>
                  <button onClick={e => { e.stopPropagation(); setCompareA(run); setActiveTab('compare') }} className="text-xs text-[color:var(--mwm-navy)] hover:text-[color:var(--mwm-navy)] font-medium px-2 py-0.5 border border-[color:var(--mwm-border)] rounded">Compare</button>
                  <button onClick={e => { e.stopPropagation(); deleteRun(run.id) }} className="text-gray-400 hover:text-red-500 text-sm px-1 font-medium">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}
