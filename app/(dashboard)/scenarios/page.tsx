'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Household = {
  id: string
  person1_name: string | null
  person1_birth_year: number
  person1_retirement_age: number
  person1_ss_claiming_age: number
  person1_longevity_age: number
  person2_name: string | null
  person2_birth_year: number | null
  person2_retirement_age: number | null
  person2_ss_claiming_age: number | null
  has_spouse: boolean
  inflation_rate: number
  growth_rate_accumulation: number
  growth_rate_retirement: number
  state_primary: string
  filing_status: string
  deduction_mode: 'standard' | 'custom' | 'none'
  custom_deduction_amount: number
}

type Income = { amount: number; start_year: number; end_year: number | null; inflation_adjust: boolean; source?: string | null }
type Expense = { amount: number; start_year: number; end_year: number | null; inflation_adjust: boolean }
type Asset = { value: number }

type TaxBracket = {
  bracket_order: number
  min_amount: number
  max_amount: number | null
  rate_pct: number
  filing_status: string
}

type StateRate = { state_code: string; rate_pct: number }
type StandardDeduction = { filing_status: string; amount: number }

type ScenarioOverrides = {
  name: string
  person1_retirement_age: number
  person1_ss_claiming_age: number
  person2_retirement_age: number | null
  person2_ss_claiming_age: number | null
  state_primary: string
  growth_rate_accumulation: number
  growth_rate_retirement: number
}

type ProjectionYear = {
  age: number
  year: number
  income: number
  expenses: number
  taxes: number
  net: number
  portfolio: number
  phase: 'accumulation' | 'retirement'
}

type ScenarioResult = {
  rows: ProjectionYear[]
  portfolioAtRetirement: number
  peakPortfolio: number
  finalPortfolio: number
  avgAnnualTaxRetirement: number
  fundsOutlast: boolean
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC'
]

// Map short filing status codes to tax bracket keys
const FS_MAP: Record<string, string> = {
  mfj: 'married_filing_jointly',
  mfs: 'married_filing_separately',
  hoh: 'head_of_household',
  qw: 'married_filing_jointly',
  single: 'single',
}

function calcFederalTax(taxableIncome: number, filingStatus: string, brackets: TaxBracket[]): number {
  if (taxableIncome <= 0) return 0
  const fs = FS_MAP[filingStatus] ?? filingStatus
  const relevant = brackets.filter(b => b.filing_status === fs).sort((a, b) => a.bracket_order - b.bracket_order)
  let tax = 0
  for (const bracket of relevant) {
    const bracketMin = bracket.min_amount
    const bracketMax = bracket.max_amount ?? Infinity
    if (taxableIncome <= bracketMin) break
    const taxableInBracket = Math.min(taxableIncome, bracketMax) - bracketMin
    tax += taxableInBracket * (bracket.rate_pct / 100)
  }
  return tax
}

function runScenario(
  household: Household,
  overrides: ScenarioOverrides,
  incomes: Income[],
  expenses: Expense[],
  assets: Asset[],
  taxBrackets: TaxBracket[],
  stateRates: StateRate[],
  standardDeductions: StandardDeduction[]
): ProjectionYear[] {
  const currentYear = new Date().getFullYear()
  const currentAge = currentYear - household.person1_birth_year
  const longevityAge = household.person1_longevity_age ?? 90
  const inflationRate = Number(household.inflation_rate) / 100 || 0.025
  const growthAccumulation = overrides.growth_rate_accumulation / 100
  const growthRetirement = overrides.growth_rate_retirement / 100
  const filingStatus = household.filing_status ?? 'single'
  const fs = FS_MAP[filingStatus] ?? filingStatus
  const stateCode = overrides.state_primary ?? ''
  const totalAssets = assets.reduce((sum, a) => sum + Number(a.value), 0)

  const rows: ProjectionYear[] = []
  let portfolio = totalAssets

  for (let age = currentAge; age <= longevityAge; age++) {
    const year = currentYear + (age - currentAge)
    const isRetirement = age >= overrides.person1_retirement_age
    const yearsFromNow = age - currentAge
    const inflFactor = Math.pow(1 + inflationRate, yearsFromNow)

    const annualIncome = incomes.reduce((sum, inc) => {
      if (year < inc.start_year) return sum
      if (inc.end_year && year > inc.end_year) return sum
      const amt = Number(inc.amount)
      return sum + (inc.inflation_adjust ? amt * inflFactor : amt)
    }, 0)

    const annualExpenses = expenses.reduce((sum, exp) => {
      if (year < exp.start_year) return sum
      if (exp.end_year && year > exp.end_year) return sum
      const amt = Number(exp.amount)
      return sum + (exp.inflation_adjust ? amt * inflFactor : amt)
    }, 0)

    let deductionAmount = 0
    if (household.deduction_mode === 'standard') {
      deductionAmount = standardDeductions.find(d => d.filing_status === fs)?.amount ?? 14600
    } else if (household.deduction_mode === 'custom') {
      deductionAmount = household.custom_deduction_amount ?? 0
    }

    const annualTaxes = taxBrackets.length > 0 && annualIncome > 0
      ? (() => {
          const taxableIncome = Math.max(0, annualIncome - deductionAmount)
          const federalTax = calcFederalTax(taxableIncome, filingStatus, taxBrackets)
          const stateRate = stateRates.find(s => s.state_code === stateCode)?.rate_pct ?? 0
          const stateTax = taxableIncome * (stateRate / 100)
          return Math.round(federalTax + stateTax)
        })()
      : 0

    const net = annualIncome - annualExpenses - annualTaxes

    if (!isRetirement) {
      portfolio = portfolio * (1 + growthAccumulation) + Math.max(0, net)
    } else {
      portfolio = portfolio * (1 + growthRetirement) + net
      if (portfolio < 0) portfolio = 0
    }

    rows.push({
      age,
      year,
      income: Math.round(annualIncome),
      expenses: Math.round(annualExpenses),
      taxes: annualTaxes,
      net: Math.round(net),
      portfolio: Math.round(portfolio),
      phase: isRetirement ? 'retirement' : 'accumulation',
    })
  }

  return rows
}

function summarize(rows: ProjectionYear[], retirementAge: number): ScenarioResult {
  const retirementRows = rows.filter(r => r.phase === 'retirement')
  const portfolioAtRetirement = rows.find(r => r.phase === 'retirement')?.portfolio ?? 0
  const peakPortfolio = Math.max(...rows.map(r => r.portfolio))
  const finalPortfolio = rows[rows.length - 1]?.portfolio ?? 0
  const avgAnnualTaxRetirement = retirementRows.length > 0
    ? Math.round(retirementRows.reduce((s, r) => s + r.taxes, 0) / retirementRows.length)
    : 0
  return { rows, portfolioAtRetirement, peakPortfolio, finalPortfolio, avgAnnualTaxRetirement, fundsOutlast: finalPortfolio > 0 }
}

function formatDollars(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

const SCENARIO_COLORS = ['#1a1a1a', '#2563eb', '#16a34a']
const SCENARIO_BG = ['bg-neutral-900', 'bg-blue-600', 'bg-green-600']
const SCENARIO_LIGHT = ['bg-neutral-50 border-neutral-200', 'bg-blue-50 border-blue-200', 'bg-green-50 border-green-200']
const SCENARIO_TEXT = ['text-neutral-900', 'text-blue-700', 'text-green-700']

export default function ScenariosPage() {
  const [household, setHousehold] = useState<Household | null>(null)
  const [incomes, setIncomes] = useState<Income[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [taxBrackets, setTaxBrackets] = useState<TaxBracket[]>([])
  const [stateRates, setStateRates] = useState<StateRate[]>([])
  const [standardDeductions, setStandardDeductions] = useState<StandardDeduction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<number | null>(null)
  const [savedIdx, setSavedIdx] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'chart' | 'table'>('chart')

  const [scenarioB, setScenarioB] = useState<ScenarioOverrides | null>(null)
  const [scenarioC, setScenarioC] = useState<ScenarioOverrides | null>(null)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [
      { data: householdData },
      { data: incomeData },
      { data: expenseData },
      { data: assetData },
      { data: bracketsData },
      { data: stateRatesData },
      { data: deductionsData },
    ] = await Promise.all([
      supabase.from('households').select('*').eq('owner_id', user.id).single(),
      supabase.from('income').select('*').eq('owner_id', user.id),
      supabase.from('expenses').select('*').eq('owner_id', user.id),
      supabase.from('assets').select('value').eq('owner_id', user.id),
      supabase.from('federal_tax_brackets').select('*'),
      supabase.from('state_tax_rates').select('*'),
      supabase.from('standard_deductions').select('*'),
    ])

    setHousehold(householdData)
    setIncomes(incomeData ?? [])
    setExpenses(expenseData ?? [])
    setAssets(assetData ?? [])
    setTaxBrackets(bracketsData ?? [])
    setStateRates(stateRatesData ?? [])
    setStandardDeductions(deductionsData ?? [])

    if (householdData) {
      const base: ScenarioOverrides = {
        name: 'Scenario B',
        person1_retirement_age: householdData.person1_retirement_age ?? 65,
        person1_ss_claiming_age: householdData.person1_ss_claiming_age ?? 67,
        person2_retirement_age: householdData.person2_retirement_age ?? null,
        person2_ss_claiming_age: householdData.person2_ss_claiming_age ?? null,
        state_primary: householdData.state_primary ?? '',
        growth_rate_accumulation: householdData.growth_rate_accumulation ?? 7,
        growth_rate_retirement: householdData.growth_rate_retirement ?? 5,
      }
      setScenarioB({ ...base, name: 'Scenario B' })
      setScenarioC({ ...base, name: 'Scenario C' })
    }

    setIsLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-neutral-500">Loading...</p></div>
  }

  if (!household || !scenarioB || !scenarioC) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-sm font-medium text-neutral-600">Complete your profile first</p>
          <a href="/profile" className="mt-3 text-sm text-indigo-600 hover:underline">Go to Profile →</a>
        </div>
      </div>
    )
  }

  // Build base overrides from household
  const baseOverrides: ScenarioOverrides = {
    name: 'Base Case',
    person1_retirement_age: household.person1_retirement_age ?? 65,
    person1_ss_claiming_age: household.person1_ss_claiming_age ?? 67,
    person2_retirement_age: household.person2_retirement_age ?? null,
    person2_ss_claiming_age: household.person2_ss_claiming_age ?? null,
    state_primary: household.state_primary ?? '',
    growth_rate_accumulation: household.growth_rate_accumulation ?? 7,
    growth_rate_retirement: household.growth_rate_retirement ?? 5,
  }

  const runAll = () => {
    const common = [incomes, expenses, assets, taxBrackets, stateRates, standardDeductions] as const
    const rowsA = runScenario(household, baseOverrides, ...common)
    const rowsB = runScenario(household, scenarioB, ...common)
    const rowsC = runScenario(household, scenarioC, ...common)
    return [
      summarize(rowsA, baseOverrides.person1_retirement_age),
      summarize(rowsB, scenarioB.person1_retirement_age),
      summarize(rowsC, scenarioC.person1_retirement_age),
    ]
  }

  const [resultA, resultB, resultC] = runAll()
  const results = [resultA, resultB, resultC]
  const overrides = [baseOverrides, scenarioB, scenarioC]
  const names = [baseOverrides.name, scenarioB.name, scenarioC.name]

  const peakAll = Math.max(...results.flatMap(r => r.rows.map(row => row.portfolio)))

  async function handleSave(idx: number) {
    const result = results[idx]
    const name = names[idx]
    setIsSaving(idx)
    setError(null)
    try {
      const supabase = createClient()
      const now = new Date()
      const timestamp = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        ' at ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      const { error } = await supabase.from('projections').insert({
        household_id: household!.id,
        scenario_name: `${name} — ${timestamp}`,
        projection_data: result.rows,
        summary: {
          at_retirement: result.portfolioAtRetirement,
          peak: result.peakPortfolio,
          final: result.finalPortfolio,
          funds_outlast: result.fundsOutlast,
        },
        calculated_at: now.toISOString(),
      })
      if (error) throw error
      setSavedIdx(idx)
      setTimeout(() => setSavedIdx(null), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setIsSaving(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Scenario Comparison</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Compare up to 3 scenarios side by side. Base Case is locked to your profile. Customize Scenario B and C freely.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      {/* Scenario Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* Base Case — locked */}
        <div className="rounded-2xl border-2 border-neutral-900 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="inline-flex items-center rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">Base Case</span>
              <p className="mt-2 text-xs text-neutral-400">Locked to your profile</p>
            </div>
            <button
              onClick={() => handleSave(0)}
              disabled={isSaving === 0}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition"
            >
              {isSaving === 0 ? 'Saving…' : savedIdx === 0 ? '✓ Saved' : 'Save'}
            </button>
          </div>
          <div className="space-y-2 text-sm text-neutral-600">
            <p><span className="font-medium text-neutral-800">{household.person1_name ?? 'Person 1'}</span> retires at {baseOverrides.person1_retirement_age}, claims SS at {baseOverrides.person1_ss_claiming_age}</p>
            {household.has_spouse && <p><span className="font-medium text-neutral-800">{household.person2_name ?? 'Person 2'}</span> retires at {baseOverrides.person2_retirement_age ?? '—'}, claims SS at {baseOverrides.person2_ss_claiming_age ?? '—'}</p>}
            <p>State: <span className="font-medium text-neutral-800">{baseOverrides.state_primary || 'None'}</span></p>
            <p>Growth: <span className="font-medium text-neutral-800">{baseOverrides.growth_rate_accumulation}% / {baseOverrides.growth_rate_retirement}%</span></p>
          </div>
        </div>

        {/* Scenario B */}
        <ScenarioEditor
          scenario={scenarioB}
          onChange={setScenarioB}
          household={household}
          colorIdx={1}
          onSave={() => handleSave(1)}
          isSaving={isSaving === 1}
          saved={savedIdx === 1}
        />

        {/* Scenario C */}
        <ScenarioEditor
          scenario={scenarioC}
          onChange={setScenarioC}
          household={household}
          colorIdx={2}
          onSave={() => handleSave(2)}
          isSaving={isSaving === 2}
          saved={savedIdx === 2}
        />
      </div>

      {/* Summary Comparison */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm mb-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Comparison Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Metric</th>
                {names.map((name, i) => (
                  <th key={i} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    <span className={`inline-flex items-center gap-1.5`}>
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SCENARIO_COLORS[i] }} />
                      <span className={SCENARIO_TEXT[i]}>{name}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {[
                { label: 'Portfolio at Retirement', key: 'portfolioAtRetirement' as const },
                { label: 'Peak Portfolio', key: 'peakPortfolio' as const },
                { label: 'Final Portfolio', key: 'finalPortfolio' as const },
                { label: 'Avg Annual Tax (Retirement)', key: 'avgAnnualTaxRetirement' as const },
              ].map(({ label, key }) => {
                const vals = results.map(r => r[key])
                const best = Math.max(...vals)
                return (
                  <tr key={key} className="hover:bg-neutral-50">
                    <td className="px-6 py-3 text-sm font-medium text-neutral-700">{label}</td>
                    {vals.map((val, i) => (
                      <td key={i} className={`px-6 py-3 text-sm font-semibold ${val === best && key !== 'avgAnnualTaxRetirement' ? SCENARIO_TEXT[i] : key === 'avgAnnualTaxRetirement' && val === Math.min(...vals) ? SCENARIO_TEXT[i] : 'text-neutral-600'}`}>
                        {formatDollars(val)}
                        {((val === best && key !== 'avgAnnualTaxRetirement') || (key === 'avgAnnualTaxRetirement' && val === Math.min(...vals))) && (
                          <span className="ml-1.5 text-xs font-normal opacity-60">★ best</span>
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
              <tr className="hover:bg-neutral-50">
                <td className="px-6 py-3 text-sm font-medium text-neutral-700">Funds Outlast</td>
                {results.map((r, i) => (
                  <td key={i} className={`px-6 py-3 text-sm font-semibold ${r.fundsOutlast ? 'text-green-600' : 'text-red-600'}`}>
                    {r.fundsOutlast ? 'Yes ✓' : 'No ✗'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart / Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm">
        <div className="flex border-b border-neutral-200 px-4 pt-4 gap-1">
          {(['chart', 'table'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg capitalize transition-colors ${
                activeTab === tab ? 'border-b-2 border-neutral-900 text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'
              }`}>
              {tab}
            </button>
          ))}
          {/* Legend */}
          <div className="ml-auto flex items-center gap-4 pb-2">
            {names.map((name, i) => (
              <span key={i} className="flex items-center gap-1.5 text-xs text-neutral-500">
                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: SCENARIO_COLORS[i] }} />
                {name}
              </span>
            ))}
          </div>
        </div>
        <div className="p-4">
          {activeTab === 'chart' ? (
            <MultiLineChart results={results} names={names} peak={peakAll} />
          ) : (
            <ComparisonTable results={results} names={names} />
          )}
        </div>
      </div>
    </div>
  )
}

function ScenarioEditor({
  scenario, onChange, household, colorIdx, onSave, isSaving, saved,
}: {
  scenario: ScenarioOverrides
  onChange: (s: ScenarioOverrides) => void
  household: Household
  colorIdx: number
  onSave: () => void
  isSaving: boolean
  saved: boolean
}) {
  const borderColor = colorIdx === 1 ? 'border-blue-500' : 'border-green-500'
  const badgeBg = colorIdx === 1 ? 'bg-blue-600' : 'bg-green-600'
  const inputClass = "block w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"

  return (
    <div className={`rounded-2xl border-2 ${borderColor} bg-white p-5`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full ${badgeBg} px-3 py-1 text-xs font-semibold text-white`}>
            {scenario.name}
          </span>
          <input
            type="text"
            value={scenario.name}
            onChange={e => onChange({ ...scenario, name: e.target.value })}
            className="text-xs border-b border-dashed border-neutral-300 bg-transparent text-neutral-500 focus:outline-none focus:border-neutral-500 w-28"
            placeholder="Rename..."
          />
        </div>
        <button onClick={onSave} disabled={isSaving}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 transition ${colorIdx === 1 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}>
          {isSaving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">{household.person1_name ?? 'Person 1'} Retire Age</label>
            <input type="number" min={50} max={80} value={scenario.person1_retirement_age}
              onChange={e => onChange({ ...scenario, person1_retirement_age: Number(e.target.value) })}
              className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">{household.person1_name ?? 'Person 1'} SS Age</label>
            <input type="number" min={62} max={70} value={scenario.person1_ss_claiming_age}
              onChange={e => onChange({ ...scenario, person1_ss_claiming_age: Number(e.target.value) })}
              className={inputClass} />
          </div>
        </div>

        {household.has_spouse && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">{household.person2_name ?? 'Person 2'} Retire Age</label>
              <input type="number" min={50} max={80} value={scenario.person2_retirement_age ?? 65}
                onChange={e => onChange({ ...scenario, person2_retirement_age: Number(e.target.value) })}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">{household.person2_name ?? 'Person 2'} SS Age</label>
              <input type="number" min={62} max={70} value={scenario.person2_ss_claiming_age ?? 67}
                onChange={e => onChange({ ...scenario, person2_ss_claiming_age: Number(e.target.value) })}
                className={inputClass} />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1">Primary State</label>
          <select value={scenario.state_primary} onChange={e => onChange({ ...scenario, state_primary: e.target.value })} className={inputClass}>
            <option value="">None</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Accum. Growth %</label>
            <input type="number" min={0} max={20} step={0.5} value={scenario.growth_rate_accumulation}
              onChange={e => onChange({ ...scenario, growth_rate_accumulation: Number(e.target.value) })}
              className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Retire Growth %</label>
            <input type="number" min={0} max={20} step={0.5} value={scenario.growth_rate_retirement}
              onChange={e => onChange({ ...scenario, growth_rate_retirement: Number(e.target.value) })}
              className={inputClass} />
          </div>
        </div>
      </div>
    </div>
  )
}

function MultiLineChart({ results, names, peak }: { results: ScenarioResult[]; names: string[]; peak: number }) {
  const allAges = results[0].rows.map(r => r.age)
  const step = allAges.length > 40 ? 5 : allAges.length > 25 ? 2 : 1
  const sampledAges = allAges.filter((_, i) => i % step === 0)

  return (
    <div className="relative">
      <div className="flex items-end gap-0.5 h-56 w-full px-2">
        {sampledAges.map((age) => (
          <div key={age} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 hidden group-hover:block whitespace-nowrap rounded-lg bg-neutral-900 px-2 py-1.5 text-xs text-white shadow-lg">
              <p className="font-semibold mb-0.5">Age {age}</p>
              {results.map((r, i) => {
                const row = r.rows.find(row => row.age === age)
                return <p key={i} style={{ color: SCENARIO_COLORS[i] === '#1a1a1a' ? '#fff' : SCENARIO_COLORS[i] }}>{names[i]}: {formatDollars(row?.portfolio ?? 0)}</p>
              })}
            </div>
            <div className="w-full flex items-end gap-px" style={{ height: '200px' }}>
              {results.map((r, i) => {
                const row = r.rows.find(row => row.age === age)
                const pct = peak > 0 ? ((row?.portfolio ?? 0) / peak) * 100 : 0
                return (
                  <div key={i} className="flex-1 rounded-t transition-all" style={{
                    height: `${Math.max(pct, 1)}%`,
                    backgroundColor: SCENARIO_COLORS[i],
                    opacity: row?.phase === 'retirement' ? 0.85 : 1,
                  }} />
                )
              })}
            </div>
            <span className="text-[10px] text-neutral-400">{age}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ComparisonTable({ results, names }: { results: ScenarioResult[]; names: string[] }) {
  const rows = results[0].rows
  return (
    <div className="overflow-auto max-h-96">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <th className="pb-2 pr-4">Age</th>
            <th className="pb-2 pr-4">Year</th>
            {names.map((name, i) => (
              <th key={i} className="pb-2 pr-4">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: SCENARIO_COLORS[i] }} />
                  {name} Portfolio
                </span>
              </th>
            ))}
            {names.map((name, i) => (
              <th key={i} className="pb-2 pr-4">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: SCENARIO_COLORS[i] }} />
                  {name} Income
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((row) => {
            const isRetirement = row.phase === 'retirement'
            return (
              <tr key={row.age} className={isRetirement ? 'bg-orange-50/40' : ''}>
                <td className="py-1.5 pr-4 font-medium text-neutral-800">{row.age}</td>
                <td className="py-1.5 pr-4 text-neutral-500">{row.year}</td>
                {results.map((r, i) => {
                  const yr = r.rows.find(y => y.age === row.age)
                  const portfolios = results.map(res => res.rows.find(y => y.age === row.age)?.portfolio ?? 0)
                  const isBest = (yr?.portfolio ?? 0) === Math.max(...portfolios)
                  return (
                    <td key={i} className={`py-1.5 pr-4 font-semibold ${isBest ? SCENARIO_TEXT[i] : 'text-neutral-600'}`}>
                      {formatDollars(yr?.portfolio ?? 0)}
                    </td>
                  )
                })}
                {results.map((r, i) => {
                  const yr = r.rows.find(y => y.age === row.age)
                  return (
                    <td key={i} className="py-1.5 pr-4 text-neutral-600">
                      {formatDollars(yr?.income ?? 0)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
