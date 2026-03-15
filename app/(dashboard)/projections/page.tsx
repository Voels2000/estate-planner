'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Household = {
  id: string
  person1_birth_year: number
  person1_retirement_age: number
  person1_longevity_age: number
  inflation_rate: number
  state_primary: string
  filing_status?: string
}

type Income = { amount: number; start_year: number; end_year: number | null; inflation_adjust: boolean }
type Expense = { amount: number; start_year: number; end_year: number | null; inflation_adjust: boolean }
type Asset = { value: number }

type TaxBracket = {
  bracket_order: number
  min_amount: number
  max_amount: number | null
  rate_pct: number
  filing_status: string
}

type StateRate = {
  state_code: string
  rate_pct: number
}

type StandardDeduction = {
  filing_status: string
  amount: number
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

function calcFederalTax(
  taxableIncome: number,
  filingStatus: string,
  brackets: TaxBracket[]
): number {
  if (taxableIncome <= 0) return 0
  const relevant = brackets
    .filter(b => b.filing_status === filingStatus)
    .sort((a, b) => a.bracket_order - b.bracket_order)
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

function calcTotalTax(
  grossIncome: number,
  filingStatus: string,
  stateCode: string,
  brackets: TaxBracket[],
  stateRates: StateRate[],
  standardDeductions: StandardDeduction[]
): number {
  if (grossIncome <= 0) return 0
  const deduction = standardDeductions.find(
    d => d.filing_status === filingStatus
  )?.amount ?? 14600
  const taxableIncome = Math.max(0, grossIncome - deduction)
  const federalTax = calcFederalTax(taxableIncome, filingStatus, brackets)
  const stateRate = stateRates.find(
    s => s.state_code === stateCode
  )?.rate_pct ?? 0
  const stateTax = taxableIncome * (stateRate / 100)
  return Math.round(federalTax + stateTax)
}

export default function ProjectionsPage() {
  const [household, setHousehold] = useState<Household | null>(null)
  const [incomes, setIncomes] = useState<Income[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [taxBrackets, setTaxBrackets] = useState<TaxBracket[]>([])
  const [stateRates, setStateRates] = useState<StateRate[]>([])
  const [standardDeductions, setStandardDeductions] = useState<StandardDeduction[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [projections, setProjections] = useState<ProjectionYear[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [scenarioName, setScenarioName] = useState('Base Case')
  const [savedMessage, setSavedMessage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'chart' | 'table'>('chart')
  const [deductionMode, setDeductionMode] = useState<'standard' | 'custom' | 'none'>('standard')
  const [customDeduction, setCustomDeduction] = useState<number>(0)

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
    setIsLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!household) return
    const currentYear = new Date().getFullYear()
    const currentAge = currentYear - household.person1_birth_year
    const retirementAge = household.person1_retirement_age ?? 65
    const longevityAge = household.person1_longevity_age ?? 90
    const inflationRate = Number(household.inflation_rate) / 100 || 0.025
    const filingStatus = household.filing_status ?? 'single'
    const stateCode = household.state_primary ?? ''
    const totalAssets = assets.reduce((sum, a) => sum + Number(a.value), 0)

    const rows: ProjectionYear[] = []
    let portfolio = totalAssets

    for (let age = currentAge; age <= longevityAge; age++) {
      const year = currentYear + (age - currentAge)
      const isRetirement = age >= retirementAge
      const yearsFromNow = age - currentAge
      const inflFactor = Math.pow(1 + inflationRate, yearsFromNow)

      // Calculate income for this year
      const annualIncome = incomes.reduce((sum, inc) => {
        if (year < inc.start_year) return sum
        if (inc.end_year && year > inc.end_year) return sum
        const amt = Number(inc.amount)
        return sum + (inc.inflation_adjust ? amt * inflFactor : amt)
      }, 0)

      // Calculate expenses for this year
      const annualExpenses = expenses.reduce((sum, exp) => {
        if (year < exp.start_year) return sum
        if (exp.end_year && year > exp.end_year) return sum
        const amt = Number(exp.amount)
        return sum + (exp.inflation_adjust ? amt * inflFactor : amt)
      }, 0)

      let deductionAmount = 0
      if (deductionMode === 'standard') {
        deductionAmount = standardDeductions.find(
          d => d.filing_status === filingStatus
        )?.amount ?? 14600
      } else if (deductionMode === 'custom') {
        deductionAmount = customDeduction
      } else {
        deductionAmount = 0
      }
      const annualTaxes = taxBrackets.length > 0
        ? (() => {
            if (annualIncome <= 0) return 0
            const taxableIncome = Math.max(0, annualIncome - deductionAmount)
            const federalTax = calcFederalTax(taxableIncome, filingStatus, taxBrackets)
            const stateRate = stateRates.find(s => s.state_code === stateCode)?.rate_pct ?? 0
            const stateTax = taxableIncome * (stateRate / 100)
            return Math.round(federalTax + stateTax)
          })()
        : 0

      const net = annualIncome - annualExpenses - annualTaxes

      // Grow portfolio at 7% during accumulation, draw down in retirement
      if (!isRetirement) {
        portfolio = portfolio * 1.07 + Math.max(0, net)
      } else {
        portfolio = portfolio * 1.05 + net
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

    setProjections(rows)
  }, [household, incomes, expenses, assets, taxBrackets, stateRates, standardDeductions, deductionMode, customDeduction])

  async function handleSave() {
    if (!household) return
    setIsSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      const summary = {
        at_retirement: projections.find(p => p.phase === 'retirement')?.portfolio ?? 0,
        peak: Math.max(...projections.map(p => p.portfolio)),
        final: projections[projections.length - 1]?.portfolio ?? 0,
        funds_outlast: (projections[projections.length - 1]?.portfolio ?? 0) > 0,
      }

      const { error } = await supabase.from('projections').insert({
        household_id: household.id,
        scenario_name: scenarioName,
        projection_data: projections,
        summary,
        calculated_at: new Date().toISOString(),
      })

      if (error) throw error
      setSavedMessage(true)
      setTimeout(() => setSavedMessage(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-neutral-500">Loading...</p></div>
  }

  if (!household) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <div className="text-4xl mb-3">📈</div>
          <p className="text-sm font-medium text-neutral-600">Complete your profile first</p>
          <a href="/profile" className="mt-3 text-sm text-indigo-600 hover:underline">Go to Profile →</a>
        </div>
      </div>
    )
  }

  const currentYear = new Date().getFullYear()
  const currentAge = currentYear - household.person1_birth_year
  const retirementRow = projections.find(p => p.phase === 'retirement')
  const finalRow = projections[projections.length - 1]
  const peakPortfolio = Math.max(...projections.map(p => p.portfolio))
  const fundsOutlast = (finalRow?.portfolio ?? 0) > 0
  const retirementRows = projections.filter(p => p.phase === 'retirement')
  const avgRetirementTax = retirementRows.length > 0
    ? Math.round(retirementRows.reduce((s, r) => s + r.taxes, 0) / retirementRows.length)
    : 0
  const taxDataAvailable = taxBrackets.length > 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Projections</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Based on your current income, expenses and assets
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
            placeholder="Scenario name"
          />
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition"
          >
            {isSaving ? 'Saving...' : 'Save Scenario'}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
      {savedMessage && <p className="mb-4 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3">Scenario saved successfully!</p>}
      {!taxDataAvailable && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ Tax data not found — projections shown pre-tax. Contact your administrator to load tax bracket data.
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-neutral-600">Tax Deduction:</span>
        {(['standard', 'custom', 'none'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setDeductionMode(mode)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition capitalize ${
              deductionMode === mode
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {mode}
          </button>
        ))}
        {deductionMode === 'custom' && (
          <input
            type="number"
            value={customDeduction}
            onChange={(e) => setCustomDeduction(Number(e.target.value))}
            placeholder="Enter deduction amount"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 w-52"
          />
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="Current Age"
          value={String(currentAge)}
          sub={`Born ${household.person1_birth_year}`}
        />
        <SummaryCard
          label="At Retirement"
          value={formatDollars(retirementRow?.portfolio ?? 0)}
          sub={`Age ${household.person1_retirement_age}`}
        />
        <SummaryCard
          label="Avg Tax in Retirement"
          value={taxDataAvailable ? formatDollars(avgRetirementTax) : '—'}
          sub={taxDataAvailable ? 'Federal + state/yr' : 'Tax data unavailable'}
          highlight={taxDataAvailable && avgRetirementTax > 0 ? 'amber' : undefined}
        />
        <SummaryCard
          label="Funds Outlast"
          value={fundsOutlast ? 'Yes ✓' : 'No ✗'}
          sub={fundsOutlast ? 'On track' : 'Review plan'}
          highlight={fundsOutlast ? 'green' : 'red'}
        />
      </div>

      {/* Chart / Table tabs */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm">
        <div className="flex border-b border-neutral-200 px-4 pt-4 gap-1">
          {(['chart', 'table'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg capitalize transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-neutral-900 text-neutral-900'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'chart' ? (
            <BarChart projections={projections} peak={peakPortfolio} />
          ) : (
            <ProjectionTable projections={projections} showTaxes={taxDataAvailable} />
          )}
        </div>
      </div>
      {taxDataAvailable && (
        <p className="mt-4 text-xs text-neutral-400">
          * Taxes estimated using {new Date().getFullYear()} federal brackets and standard deduction for{' '}
          <span className="capitalize">{(household.filing_status ?? 'single').replace(/_/g, ' ')}</span> filers
          {household.state_primary ? ` + ${household.state_primary} state rate` : ''}.
          Tax brackets are not inflation-adjusted in this model.
        </p>
      )}
    </div>
  )
}

function SummaryCard({ label, value, sub, highlight }: {
  label: string; value: string; sub: string; highlight?: 'green' | 'red' | 'amber'
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${
        highlight === 'green' ? 'text-green-600' :
        highlight === 'red' ? 'text-red-600' :
        highlight === 'amber' ? 'text-amber-600' :
        'text-neutral-900'
      }`}>{value}</p>
      <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>
    </div>
  )
}

function BarChart({ projections, peak }: { projections: ProjectionYear[]; peak: number }) {
  const step = projections.length > 40 ? 5 : projections.length > 25 ? 2 : 1
  const sampled = projections.filter((_, i) => i % step === 0)

  return (
    <div className="flex items-end gap-0.5 h-56 w-full px-2">
      {sampled.map((p) => {
        const pct = peak > 0 ? (p.portfolio / peak) * 100 : 0
        return (
          <div key={p.age} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="relative w-full flex items-end" style={{ height: '200px' }}>
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 hidden group-hover:block whitespace-nowrap rounded-lg bg-neutral-900 px-2 py-1 text-xs text-white shadow-lg">
                Age {p.age}: {formatDollars(p.portfolio)}
              </div>
              <div
                className={`w-full rounded-t transition-all ${
                  p.phase === 'retirement'
                    ? p.portfolio < peak * 0.1 ? 'bg-red-400' : 'bg-orange-400'
                    : 'bg-neutral-700'
                }`}
                style={{ height: `${Math.max(pct, 1)}%` }}
              />
            </div>
            <span className="text-[10px] text-neutral-400">{p.age}</span>
          </div>
        )
      })}
    </div>
  )
}

function ProjectionTable({ projections, showTaxes }: { projections: ProjectionYear[]; showTaxes: boolean }) {
  return (
    <div className="overflow-auto max-h-96">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <th className="pb-2 pr-4">Age</th>
            <th className="pb-2 pr-4">Year</th>
            <th className="pb-2 pr-4">Income</th>
            <th className="pb-2 pr-4">Expenses</th>
            {showTaxes && <th className="pb-2 pr-4">Taxes</th>}
            <th className="pb-2 pr-4">Net</th>
            <th className="pb-2">Portfolio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {projections.map((p) => (
            <tr key={p.age} className={p.phase === 'retirement' ? 'bg-orange-50/50' : ''}>
              <td className="py-1.5 pr-4 font-medium text-neutral-800">{p.age}</td>
              <td className="py-1.5 pr-4 text-neutral-500">{p.year}</td>
              <td className="py-1.5 pr-4 text-green-600">{formatDollars(p.income)}</td>
              <td className="py-1.5 pr-4 text-red-500">{formatDollars(p.expenses)}</td>
              {showTaxes && (
                <td className="py-1.5 pr-4 text-amber-600">
                  {p.taxes > 0 ? formatDollars(p.taxes) : '—'}
                </td>
              )}
              <td className={`py-1.5 pr-4 font-medium ${p.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {p.net >= 0 ? '+' : ''}{formatDollars(p.net)}
              </td>
              <td className={`py-1.5 font-semibold ${p.portfolio < 1000 ? 'text-red-600' : 'text-neutral-900'}`}>
                {formatDollars(p.portfolio)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatDollars(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}
