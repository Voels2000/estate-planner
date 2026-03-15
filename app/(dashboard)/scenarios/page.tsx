'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC'
]

type Income = { amount: number; start_year: number; end_year: number | null; inflation_adjust: boolean }
type Expense = { amount: number; start_year: number; end_year: number | null; inflation_adjust: boolean }

type ScenarioInputs = {
  name: string
  retirementAge: number
  ssClaimingAge: number
  longevityAge: number
  statePrimary: string
  stateCompare: string
  inflationRate: number
}

type ScenarioResult = {
  atRetirement: number
  peak: number
  final: number
  fundsOutlast: boolean
  monthlyAtRetirement: number
}

type Household = {
  id: string
  person1_birth_year: number
  person1_retirement_age: number
  person1_ss_claiming_age: number
  person1_longevity_age: number
  state_primary: string
  state_compare: string
  inflation_rate: number
}

function calcProjection(
  inputs: ScenarioInputs,
  birthYear: number,
  incomes: Income[],
  expenses: Expense[],
  totalAssets: number
): ScenarioResult {
  const currentYear = new Date().getFullYear()
  const currentAge = currentYear - birthYear
  const inflationRate = inputs.inflationRate / 100

  let portfolio = totalAssets
  let peak = totalAssets
  let atRetirement = 0
  let monthlyAtRetirement = 0

  for (let age = currentAge; age <= inputs.longevityAge; age++) {
    const year = currentYear + (age - currentAge)
    const isRetirement = age >= inputs.retirementAge
    const yearsFromNow = age - currentAge
    const inflFactor = Math.pow(1 + inflationRate, yearsFromNow)

    const annualIncome = incomes.reduce((sum, inc) => {
      if (year < inc.start_year) return sum
      if (inc.end_year && year > inc.end_year) return sum
      return sum + (inc.inflation_adjust ? Number(inc.amount) * inflFactor : Number(inc.amount))
    }, 0)

    const annualExpenses = expenses.reduce((sum, exp) => {
      if (year < exp.start_year) return sum
      if (exp.end_year && year > exp.end_year) return sum
      return sum + (exp.inflation_adjust ? Number(exp.amount) * inflFactor : Number(exp.amount))
    }, 0)

    const net = annualIncome - annualExpenses

    if (!isRetirement) {
      portfolio = portfolio * 1.07 + Math.max(0, net)
    } else {
      portfolio = portfolio * 1.05 + net
      if (portfolio < 0) portfolio = 0
    }

    if (portfolio > peak) peak = portfolio

    if (age === inputs.retirementAge) {
      atRetirement = Math.round(portfolio)
      monthlyAtRetirement = Math.round((annualIncome - annualExpenses) / 12)
    }
  }

  return {
    atRetirement,
    peak: Math.round(peak),
    final: Math.round(portfolio),
    fundsOutlast: portfolio > 0,
    monthlyAtRetirement,
  }
}

export default function ScenariosPage() {
  const [household, setHousehold] = useState<Household | null>(null)
  const [incomes, setIncomes] = useState<Income[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [totalAssets, setTotalAssets] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [scenarios, setScenarios] = useState<ScenarioInputs[]>([])
  const [savingIndex, setSavingIndex] = useState<number | null>(null)
  const [savedIndex, setSavedIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [
      { data: householdData },
      { data: incomeData },
      { data: expenseData },
      { data: assetData },
    ] = await Promise.all([
      supabase.from('households').select('*').eq('owner_id', user.id).single(),
      supabase.from('income').select('*').eq('owner_id', user.id),
      supabase.from('expenses').select('*').eq('owner_id', user.id),
      supabase.from('assets').select('value').eq('owner_id', user.id),
    ])

    if (householdData) {
      setHousehold(householdData)
      const base: ScenarioInputs = {
        name: 'Base Case',
        retirementAge: householdData.person1_retirement_age ?? 65,
        ssClaimingAge: householdData.person1_ss_claiming_age ?? 67,
        longevityAge: householdData.person1_longevity_age ?? 90,
        statePrimary: householdData.state_primary ?? '',
        stateCompare: householdData.state_compare ?? '',
        inflationRate: Number(householdData.inflation_rate) ?? 2.5,
      }
      setScenarios([
        base,
        { ...base, name: 'Retire Earlier', retirementAge: Math.max(50, base.retirementAge - 5) },
        { ...base, name: 'Retire Later', retirementAge: Math.min(80, base.retirementAge + 5) },
      ])
    }

    setIncomes(incomeData ?? [])
    setExpenses(expenseData ?? [])
    setTotalAssets((assetData ?? []).reduce((sum, a) => sum + Number(a.value), 0))
    setIsLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function updateScenario(index: number, field: keyof ScenarioInputs, value: string | number) {
    setScenarios(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  async function handleSave(index: number) {
    if (!household) return
    setSavingIndex(index)
    setError(null)

    try {
      const supabase = createClient()
      const inputs = scenarios[index]
      const result = calcProjection(inputs, household.person1_birth_year, incomes, expenses, totalAssets)

      const { error } = await supabase.from('projections').insert({
        household_id: household.id,
        scenario_name: inputs.name,
        state_override: inputs.statePrimary,
        projection_data: { inputs, result },
        summary: {
          at_retirement: result.atRetirement,
          peak: result.peak,
          final: result.final,
          funds_outlast: result.fundsOutlast,
        },
        calculated_at: new Date().toISOString(),
      })

      if (error) throw error
      setSavedIndex(index)
      setTimeout(() => setSavedIndex(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSavingIndex(null)
    }
  }

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-neutral-500">Loading...</p></div>
  }

  if (!household) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <div className="text-4xl mb-3">🔮</div>
          <p className="text-sm font-medium text-neutral-600">Complete your profile first</p>
          <a href="/profile" className="mt-3 text-sm text-indigo-600 hover:underline">Go to Profile →</a>
        </div>
      </div>
    )
  }

  const results = scenarios.map(s =>
    calcProjection(s, household.person1_birth_year, incomes, expenses, totalAssets)
  )

  const COLORS = ['bg-neutral-900', 'bg-indigo-600', 'bg-emerald-600']
  const TEXT_COLORS = ['text-neutral-900', 'text-indigo-600', 'text-emerald-600']

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Scenarios</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Compare up to 3 scenarios side by side. Adjust inputs to see how changes affect your plan.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {scenarios.map((scenario, index) => {
          const result = results[index]
          return (
            <div key={index} className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
              {/* Scenario header */}
              <div className={`${COLORS[index]} px-6 py-4`}>
                <input
                  type="text"
                  value={scenario.name}
                  onChange={(e) => updateScenario(index, 'name', e.target.value)}
                  className="w-full bg-transparent text-white font-semibold text-base placeholder-white/60 border-none outline-none"
                />
              </div>

              {/* Inputs */}
              <div className="px-6 py-4 space-y-3 border-b border-neutral-100">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Assumptions</h3>

                <SliderRow
                  label="Retirement Age"
                  value={scenario.retirementAge}
                  min={50} max={80}
                  format={(v) => `${v}`}
                  color={TEXT_COLORS[index]}
                  onChange={(v) => updateScenario(index, 'retirementAge', v)}
                />
                <SliderRow
                  label="SS Claiming Age"
                  value={scenario.ssClaimingAge}
                  min={62} max={70}
                  format={(v) => `${v}`}
                  color={TEXT_COLORS[index]}
                  onChange={(v) => updateScenario(index, 'ssClaimingAge', v)}
                />
                <SliderRow
                  label="Longevity Age"
                  value={scenario.longevityAge}
                  min={70} max={105}
                  format={(v) => `${v}`}
                  color={TEXT_COLORS[index]}
                  onChange={(v) => updateScenario(index, 'longevityAge', v)}
                />
                <SliderRow
                  label="Inflation Rate"
                  value={scenario.inflationRate}
                  min={0} max={10} step={0.1}
                  format={(v) => `${v}%`}
                  color={TEXT_COLORS[index]}
                  onChange={(v) => updateScenario(index, 'inflationRate', v)}
                />

                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Primary State</label>
                  <select
                    value={scenario.statePrimary}
                    onChange={(e) => updateScenario(index, 'statePrimary', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select state</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Compare State</label>
                  <select
                    value={scenario.stateCompare}
                    onChange={(e) => updateScenario(index, 'stateCompare', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">None</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Results */}
              <div className="px-6 py-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Projected Results</h3>

                <ResultRow label="At Retirement" value={formatDollars(result.atRetirement)} />
                <ResultRow label="Peak Portfolio" value={formatDollars(result.peak)} />
                <ResultRow label="Final Balance" value={formatDollars(result.final)} />
                <ResultRow
                  label="Funds Outlast"
                  value={result.fundsOutlast ? 'Yes ✓' : 'No ✗'}
                  highlight={result.fundsOutlast ? 'green' : 'red'}
                />
                <ResultRow
                  label="Monthly at Retirement"
                  value={`${result.monthlyAtRetirement >= 0 ? '+' : ''}${formatDollars(result.monthlyAtRetirement)}`}
                  highlight={result.monthlyAtRetirement >= 0 ? 'green' : 'red'}
                />
              </div>

              {/* Save button */}
              <div className="px-6 pb-6">
                {savedIndex === index && (
                  <p className="text-xs text-green-600 text-center mb-2">Saved successfully!</p>
                )}
                <button
                  onClick={() => handleSave(index)}
                  disabled={savingIndex === index}
                  className={`w-full rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 ${COLORS[index]} hover:opacity-90`}
                >
                  {savingIndex === index ? 'Saving...' : 'Save Scenario'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SliderRow({ label, value, min, max, step = 1, format, color, onChange }: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format: (v: number) => string
  color: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-neutral-600">{label}</span>
        <span className={`font-semibold ${color}`}>{format(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 cursor-pointer accent-neutral-900"
      />
    </div>
  )
}

function ResultRow({ label, value, highlight }: {
  label: string; value: string; highlight?: 'green' | 'red'
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className={`text-sm font-semibold ${
        highlight === 'green' ? 'text-green-600' :
        highlight === 'red' ? 'text-red-600' :
        'text-neutral-900'
      }`}>{value}</span>
    </div>
  )
}

const inputClass = "block w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs text-neutral-900 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"

function formatDollars(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(Math.abs(n)).toLocaleString()}`
}
