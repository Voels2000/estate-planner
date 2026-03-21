'use client'

import { useState, useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { formatCurrency } from '@/lib/insurance'
import type { MonteCarloInputs, YearlyDataPoint } from '@/lib/monte-carlo'

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
}

function confidenceDot(c: Confidence | undefined) {
  if (c === 'profile')   return <span title="Pulled from your profile" className="text-green-500 text-xs ml-1">●</span>
  if (c === 'estimated') return <span title="timated from your profile" className="text-amber-400 text-xs ml-1">●</span>
  return <span title="Not found — please enter manually" className="text-red-400 text-xs ml-1">○</span>
}

function SuccessGauge({ rate }: { rate: number }) {
  const color = rate >= 90 ? '#22c55e' : rate >= 75 ? '#f59e0b' : rate >= 60 ? '#f97316' : '#ef4444'
  const label = rate >= 90 ? 'Excellent' : rate >= 75 ? 'Good' : rate >= 60 ? 'Moderate' : 'High Risk'
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="10" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10" strokeDasharray={`${rate * 2.513} 251.3`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{rate}%</span>
          <span className="text-xs text-gray-500">success</span>
        </div>
      </div>
      <span className="text-sm font-medium" style={{ color }}>{label}</span>
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

function FanChart({ run }: { run: SavedRun }) {
  const data = run.percentile_50.map((pt, i) => ({
    age: pt.age,
    p10: run.percentile_10[i]?.balance ?? 0,
    p25: run.percentile_25[i]?.balance ?? 0,
    p50: run.percentile_50[i]?.balance ?? 0,
    p75: run.percentile_75[i]?.balance ?? 0,
    p90: run.percentile_90[i]?.balance ?? 0,
  }))
  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
        <defs>
          <linearGradient id="g90" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
          </linearGradient>
          <linearGradient id="g50" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="age" label={{ value: 'Age', position: 'insideBottom', offset: -2 }} tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} width={70} />
        <Tooltip formatter={(v, name) => [formatCurrency(Number(v ?? 0)), name as string]} labelFormatter={(l) => `Age ${l}`} />
        <ReferenceLine x={run.retirement_age} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Retirement', fontSize: 11, fill: '#94a3b8' }} />
        <Area type="monotone" dataKey="p90" stroke="#a5b4fc" fill="url(#g90)" strokeWidth={1} name="90th pct" />
        <Area type="monotone" dataKey="p75" stroke="#818cf8" fill="none" strokeWidth={1} name="75th pct" />
        <Area type="monotone" dataKey="p50" stroke="#6366f1" fill="url(#g50)" strokeWidth={2} name="Median" />
        <Area type="monotone" dataKey="p25" stroke="#4f46e5" fill="none" strokeWidth={1} name="25th pct" strokeDasharray="3 3" />
        <Area type="monotone" dataKey="p10" stroke="#3730a3" fill="none" strokeWidth={1} name="10th pct" strokeDasharray="3 3" />
      </AreaChart>
    </ResponsiveContainer>
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
        className={`w-full border border-gray-300 rounded-lg py-2 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${prefix ? 'pl-7' : 'pl-3'}`}
      />
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-l-2 border-indigo-400 pl-2 mb-3">
      <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">{title}</p>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
  )
}

export function MonteCarloClient() {
  const [step, setStep]             = useState<Step>('portfolio')
  const [inputs, setInputs]         = useState<MonteCarloInputs>(EMPTY_INPUTS)
  const [confidence, setConfidence] = useState<Record<string, Confidence>>({})
  const [summary, setSummary]       = useState<PrefillSummary | null>(null)
  const [result, setResult]         = useState<SavedRun | null>(null)
  const [history, setHistory]       = useState<SavedRun[]>([])
  const [loading, setLoading]       = useState(false)
  const [prefilling, setPrefilling] = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [label, setLabel]           = useState('')
  const [p1Name, setP1Name]         = useState('Person 1')
  const [p2Name, setP2Name]         = useState('Person 2')

  const set = (k: keyof MonteCarloInputs, v: number | boolean) =>
    setInputs(prev => ({ ...prev, [k]: v }))

  const allocationTotal = inputs.stocks_pct + inputs.bonds_pct + inputs.cash_pct
  const allocationValid = allocationTotal === 100

  const missingCritical = ['current_age', 'current_portfolio', 'annual_spending'].filter(k => confidence[k] === 'missing' || !inputs[k as keyof MonteCarloInputs])

  useEffect(() => {
    Promise.all([
      fetch('/api/monte-carlo/prefill').then(r => r.json()),
      fetch('/api/monte-carlo').then(r => r.json()),
    ]).then(([prefillData, historyData]) => {
      if (prefillData?.prefill) {
        const p = prefillData.prefill
        setInputs(prev => ({
          ...prev,
          birth_year:                  p.birth_year               ?? prev.birth_year,
          current_age:                 p.current_age              ?? prev.current_age,
          retirement_age:              p.retirement_age           ?? prev.retirement_age,
          life_expectancy:             p.life_expectancy          ?? prev.life_expectancy,
          inflation_rate:              p.inflation_rate           ?? prev.inflation_rate,
          social_security_monthly:     p.social_security_monthly  ?? prev.social_security_monthly,
          social_security_start_age:   p.social_security_start_age ?? prev.social_security_start_age,
          has_spouse:                  p.has_spouse               ?? prev.has_spouse,
          p2_birth_year:               p.p2_birth_year            ?? prev.p2_birth_year,
          p2_current_age:              p.p2_current_age           ?? prev.p2_current_age,
          p2_retirement_age:           p.p2_retirement_age        ?? prev.p2_retirement_age,
          p2_life_expectancy:          p.p2_life_expectancy       ?? prev.p2_life_expectancy,
          p2_social_security_monthly:  p.p2_social_security_monthly ?? prev.p2_social_security_monthly,
          p2_social_security_start_age: p.p2_social_security_start_age ?? prev.p2_social_security_start_age,
          current_portfolio:           p.current_portfolio        ?? prev.current_portfolio,
          stocks_pct:                  p.stocks_pct               ?? prev.stocks_pct,
          bonds_pct:                   p.bonds_pct                ?? prev.bonds_pct,
          cash_pct:                    p.cash_pct                 ?? prev.cash_pct,
          other_income_annual:         p.other_income_annual      ?? prev.other_income_annual,
          annual_spending:             p.annual_spending          ?? prev.annual_spending,
          survivor_spending_pct:       p.survivor_spending_pct    ?? prev.survivor_spending_pct,
        }))
        if (prefillData.person1_name) setP1Name(prefillData.person1_name)
        if (prefillData.person2_name) setP2Name(prefillData.person2_name)
        setConfidence(prefillData.confidence ?? {})
        setSummary(prefillData.summary ?? null)
      }
      if (Array.isArray(historyData)) setHistory(historyData)
      setPrefilling(false)
    }).catch(() => setPrefilling(false))
  }, [])

  async function runSimulation() {
    if (!allocationValid) { setError('Allocation must sum to 100%'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/monte-carlo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...inputs, label }),
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
  }

  const stepIdx = STEPS.findIndex(s => s.key === step)

  if (prefilling) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 flex items-center justify-center h-64 text-gray-400 text-sm gap-3">
        <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p>Loading your profile data...</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Monte Carlo Simulations</h1>
        <p className="text-gray-500 mt-1">Probabilistic retirement modeling across 1,000+ market scenarios</p>
      </div>

      {summary && (
        <div className="rounded-xl border p-4 space-y-2 bg-indigo-50 border-indigo-100">
          <p className="text-sm font-semibold text-indigo-900">We pre-filled what we could from your profile</p>
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1 text-green-700"><span className="text-green-500">●</span> {summary.profile_count} pulled from profile</span>
            <span className="flex items-center gap-1 text-amber-700"><span className="text-amber-400">●</span> {summary.estimated_count} estimated</span>
            <span className="flex items-center gap-1 text-red-600"><span className="text-red-400">○</span> {summary.missing_count} need your input</span>
          </div>
          {!summary.has_household && (
            <p className="text-xs text-indigo-700">Tip: Complete your <a href="/profile" className="underline font-medium">Profile</a> to auto-fill age, retirement age, and Social Security estimates.</p>
          )}
          {!summary.has_assets && (
            <p className="text-xs text-indigo-700">Tip: Add entries in <a href="/assets" className="underline font-medium">Assets</a> to auto-fill your portfolio balance.</p>
          )}
          {!summary.has_expenses && (
            <p className="text-xs text-indigo-700">Tip: Add entries in <a href="/expenses" className="underline font-medium">Expenses</a> to auto-fill your retirement spending estimate.</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {STEPS.map((s, i) => (
              <button key={s.key} onClick={() => setStep(s.key)} className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${step === s.key ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
                {i + 1}
              </button>
            ))}
          </div>
          <p className="text-sm font-semibold text-gray-700">{STEPS[stepIdx].label}</p>

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
              <button onClick={() => setStep('spending')} className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700">Next</button>
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
                      className="flex-1 accent-indigo-600"
                    />
                    <span className="text-sm font-medium w-10 text-right">{inputs.survivor_spending_pct}%</span>
                  </div>
                  <p className="texxs text-gray-400">Industry standard is 70-80% of joint spending</p>
                </Field>
              )}

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
                <button onClick={() => setStep('assumptions')} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700">Next</button>
              </div>
            </div>
          )}

          {step === 'assumptions' && (
            <div className="space-y-4">
              <Field label="Inflation Rate %" hint="Historical avg: 2.5-3%" confidence={confidence.inflation_rate}>
                <NumInput value={inputs.inflation_rate} onChange={v => set('inflation_rate', v)} step={0.1} />
              </Field>
              <Field label="Simulations" hint="More = slower but more accurate">
                <select
                  value={inputs.simulation_count}
                  onChange={e => set('simulation_count', Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={500}>500 - Fast</option>
                  <option value={1000}>1,000 - Balanced</option>
                  <option value={5000}>5,000 - Precise</option>
                  <option value={10000}>10,000 - Maximum</option>
                </select>
              </Field>
              <Field label="Include RMDs" hint="SECURE 2.0: age 73 if born before 1960, age 75 if born 1960 or later">
                <div className="flex items-center gap-2 mt-1">
                  <input type="checkbox" checked={inputs.include_rmd} onChange={e => set('include_rmd', e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                  <span className="text-sm text-gray-600">Factor in RMDs per SECURE 2.0</span>
                </div>
              </Field>
              <div className="flex gap-2">
                <button onClick={() => setStep('spending')} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Back</button>
                <button onClick={() => setStep('review')} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700">Next</button>
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
                <div className="flex justify-between"><span className="text-gray-500">Inflation</span><span className="font-medium">{inputs.inflation_rate}%</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Simulations</span><span className="font-medium">{inputs.simulation_count.toLocaleString()}</span></div>
              </div>
              <div className="text-xs text-gray-400 flex flex-wrap gap-3">
                <span className="flex items-center gap-1"><span className="text-green-500">●</span> From your profile</span>
                <span className="flex items-center gap-1"><span className="text-amber-400">●</span> Estimated</span>
                <span className="flex items-center gap-1"><span className="text-red-400">○</span> Manual eneded</span>
              </div>
              <Field label="Label this run (optional)">
                <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Base case, Early retirement..." className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </Field>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => setStep('assumptions')} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Back</button>
                <button onClick={runSimulation} disabled={loading || !allocationValid} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {loading ? 'Running...' : 'Run Simulation'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {!result && !loading && (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">
              <p className="text-4xl mb-3">📊</p>
              <p>Fill in your inputs and run a simulation</p>
              <p className="text-xs mt-1">Results will appear here</p>
            </div>
          )}
          {loading && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-sm gap-3">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <p>Running {inputs.simulation_count.toLocaleString()} simulations...</p>
            </div>
          )}
          {result && !loading && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex its-center justify-between mb-4">
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
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-1">
                <p className="text-sm font-semibold text-indigo-900">Analysis</p>
                <p className="text-sm text-indigo-800">{result.insight}</p>
                <p className="text-sm text-indigo-700 mt-1">{result.insight_boost}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Portfolio Outcome Range</h3>
                <FanChart run={result} />
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
                  {['90th pct', '75th pct', 'Median', '25th pct', '10th pct'].map(l => (
                    <span key={l} className="flex items-center gap-1">
                      <span className="w-3 h-0.5 bg-indigo-400 inline-block" />{l}
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
                    {run.success_rate}% success
                  </span>
                  <button onClick={e => { e.stopPropagation(); deleteRun(run.id) }} className="text-gray-300 hover:text-red-400 text-xs">X</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
