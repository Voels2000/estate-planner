'use client'

// ─────────────────────────────────────────
// Menu: Financial Planning > Scenarios
// Route: /scenarios
// ─────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { displayPersonFirstName } from '@/lib/display-person-name'
import type { YearRow } from '@/lib/calculations/projection-complete'

type Household = {
  id: string
  person1_name: string | null
  person1_birth_year: number
  person1_retirement_age: number
  person1_ss_claiming_age: number
  person2_name: string | null
  person2_birth_year: number | null
  person2_retirement_age: number | null
  person2_ss_claiming_age: number | null
  has_spouse: boolean
  state_primary: string
  growth_rate_accumulation: number
  growth_rate_retirement: number
}

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

type ScenarioResult = {
  rows: YearRow[]
  portfolioAtRetirement: number
  peakPortfolio: number
  finalPortfolio: number
  avgAnnualTaxRetirement: number
  fundsOutlast: boolean
} | null

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC'
]

const SCENARIO_COLORS = ['#1a1a1a', '#2563eb', '#16a34a']
const SCENARIO_TEXT   = ['text-neutral-900', 'text-blue-700', 'text-green-700']

function buildQueryString(overrides: ScenarioOverrides): string {
  const params = new URLSearchParams({
    state_primary:            overrides.state_primary ?? '',
    growth_rate_accumulation: String(overrides.growth_rate_accumulation),
    growth_rate_retirement:   String(overrides.growth_rate_retirement),
    person1_retirement_age:   String(overrides.person1_retirement_age),
    person1_ss_claiming_age:  String(overrides.person1_ss_claiming_age),
  })
  if (overrides.person2_retirement_age !== null && overrides.person2_retirement_age !== undefined) {
    params.set('person2_retirement_age', String(overrides.person2_retirement_age))
  } else {
    params.set('person2_retirement_age', 'null')
  }
  if (overrides.person2_ss_claiming_age !== null && overrides.person2_ss_claiming_age !== undefined) {
    params.set('person2_ss_claiming_age', String(overrides.person2_ss_claiming_age))
  } else {
    params.set('person2_ss_claiming_age', 'null')
  }
  return params.toString()
}

function summarize(rows: YearRow[], retirementAge: number) {
  const retirementRows      = rows.filter(r => r.age_person1 >= retirementAge)
  const portfolioAtRetirement = rows.find(r => r.age_person1 >= retirementAge)?.net_worth ?? 0
  const peakPortfolio       = Math.max(...rows.map(r => r.net_worth))
  const finalPortfolio      = rows[rows.length - 1]?.net_worth ?? 0
  const avgAnnualTaxRetirement = retirementRows.length > 0
    ? Math.round(retirementRows.reduce((s, r) => s + r.tax_total, 0) / retirementRows.length)
    : 0
  return { rows, portfolioAtRetirement, peakPortfolio, finalPortfolio, avgAnnualTaxRetirement, fundsOutlast: finalPortfolio > 0 }
}

function formatDollars(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

const STORAGE_KEY_B = 'scenario_overrides_b'
const STORAGE_KEY_C = 'scenario_overrides_c'

function loadStoredScenario(key: string): Partial<ScenarioOverrides> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveStoredScenario(key: string, scenario: ScenarioOverrides) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(scenario))
  } catch {
    // ignore quota errors
  }
}

export default function ScenariosPage() {
  const [household, setHousehold]     = useState<Household | null>(null)
  const [isLoading, setIsLoading]     = useState(true)
  const [isSaving, setIsSaving]       = useState<number | null>(null)
  const [savedIdx, setSavedIdx]       = useState<number | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [activeTab, setActiveTab]     = useState<'chart' | 'table'>('chart')

  const [scenarioB, setScenarioB] = useState<ScenarioOverrides | null>(null)
  const [scenarioC, setScenarioC] = useState<ScenarioOverrides | null>(null)

  const [resultA, setResultA] = useState<ScenarioResult>(null)
  const [resultB, setResultB] = useState<ScenarioResult>(null)
  const [resultC, setResultC] = useState<ScenarioResult>(null)
  const [loadingA, setLoadingA] = useState(false)
  const [loadingB, setLoadingB] = useState(false)
  const [loadingC, setLoadingC] = useState(false)

  // Debounce timers
  const timerB = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerC = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch base scenario (no overrides) ──────────────────────────────────────
  const fetchBase = useCallback(async () => {
    setLoadingA(true)
    try {
      const res = await fetch('/api/projection')
      const data = await res.json()
      if (data.rows) setResultA(summarize(data.rows, data.household?.person1_retirement_age ?? 65))
    } catch {
      setError('Failed to load base scenario.')
    } finally {
      setLoadingA(false)
    }
  }, [])

  // ── Fetch a scenario with overrides ─────────────────────────────────────────
  async function fetchScenario(
    overrides: ScenarioOverrides,
    setter: (r: ScenarioResult) => void,
    setLoading: (b: boolean) => void
  ) {
    setLoading(true)
    try {
      const qs  = buildQueryString(overrides)
      const res = await fetch(`/api/projection?${qs}`)
      const data = await res.json()
      if (data.rows) setter(summarize(data.rows, overrides.person1_retirement_age))
    } catch {
      // silently fail — keep previous result visible
    } finally {
      setLoading(false)
    }
  }

  // ── Load household on mount ──────────────────────────────────────────────────
  const loadHousehold = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: householdData } = await supabase
      .from('households')
      .select('*')
      .eq('owner_id', user.id)
      .single()

    if (householdData) {
      setHousehold(householdData)
      const base: ScenarioOverrides = {
        name: 'Scenario B',
        person1_retirement_age:  householdData.person1_retirement_age ?? 65,
        person1_ss_claiming_age: householdData.person1_ss_claiming_age ?? 67,
        person2_retirement_age:  householdData.person2_retirement_age ?? null,
        person2_ss_claiming_age: householdData.person2_ss_claiming_age ?? null,
        state_primary:           householdData.state_primary ?? '',
        growth_rate_accumulation: householdData.growth_rate_accumulation ?? 7,
        growth_rate_retirement:   householdData.growth_rate_retirement ?? 5,
      }
      const storedB = loadStoredScenario(STORAGE_KEY_B)
      const storedC = loadStoredScenario(STORAGE_KEY_C)
      setScenarioB({ ...base, name: 'Scenario B', ...storedB })
      setScenarioC({ ...base, name: 'Scenario C', ...storedC })
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadHousehold()
    fetchBase()
  }, [loadHousehold, fetchBase])

  // ── Re-run B when scenarioB changes (debounced 600ms) ───────────────────────
  useEffect(() => {
    if (!scenarioB) return
    saveStoredScenario(STORAGE_KEY_B, scenarioB)
    if (timerB.current) clearTimeout(timerB.current)
    timerB.current = setTimeout(() => {
      fetchScenario(scenarioB, setResultB, setLoadingB)
    }, 600)
    return () => { if (timerB.current) clearTimeout(timerB.current) }
  }, [scenarioB])

  // ── Re-run C when scenarioC changes (debounced 600ms) ───────────────────────
  useEffect(() => {
    if (!scenarioC) return
    saveStoredScenario(STORAGE_KEY_C, scenarioC)
    if (timerC.current) clearTimeout(timerC.current)
    timerC.current = setTimeout(() => {
      fetchScenario(scenarioC, setResultC, setLoadingC)
    }, 600)
    return () => { if (timerC.current) clearTimeout(timerC.current) }
  }, [scenarioC])

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-neutral-500">Loading…</p></div>
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

  const results = [resultA, resultB, resultC]
  const names   = ['Base Case', scenarioB.name, scenarioC.name]
  const loading  = [loadingA, loadingB, loadingC]

  const peakAll = Math.max(...results.flatMap(r => r?.rows.map(row => row.net_worth) ?? [0]))

  async function handleSave(idx: number) {
    const result = results[idx]
    if (!result) return
    setIsSaving(idx)
    setError(null)
    try {
      const supabase = createClient()
      const now       = new Date()
      const timestamp = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        ' at ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      const { error } = await supabase.from('projections').insert({
        household_id: household!.id,
        scenario_name: `${names[idx]} — ${timestamp}`,
        projection_data: result.rows,
        summary: {
          at_retirement: result.portfolioAtRetirement,
          peak:          result.peakPortfolio,
          final:         result.finalPortfolio,
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
            <button onClick={() => handleSave(0)} disabled={isSaving === 0 || !resultA}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition">
              {isSaving === 0 ? 'Saving…' : savedIdx === 0 ? '✓ Saved' : 'Save'}
            </button>
          </div>
          <div className="space-y-2 text-sm text-neutral-600">
            <p><span className="font-medium text-neutral-800">{displayPersonFirstName(household.person1_name, 'Person 1')}</span> retires at {household.person1_retirement_age}, SS at {household.person1_ss_claiming_age}</p>
            {household.has_spouse && <p><span className="font-medium text-neutral-800">{displayPersonFirstName(household.person2_name, 'Person 2')}</span> retires at {household.person2_retirement_age ?? '—'}, SS at {household.person2_ss_claiming_age ?? '—'}</p>}
            <p>State: <span className="font-medium text-neutral-800">{household.state_primary || 'None'}</span></p>
            <p>Growth: <span className="font-medium text-neutral-800">{household.growth_rate_accumulation}% / {household.growth_rate_retirement}%</span></p>
          </div>
          {loadingA && <p className="mt-3 text-xs text-neutral-400 animate-pulse">Calculating…</p>}
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
          isCalculating={loadingB}
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
          isCalculating={loadingC}
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
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SCENARIO_COLORS[i] }} />
                      <span className={SCENARIO_TEXT[i]}>{name}</span>
                      {loading[i] && <span className="text-neutral-300 text-xs animate-pulse">●</span>}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {([
                { label: 'Portfolio at Retirement', key: 'portfolioAtRetirement' as const },
                { label: 'Peak Portfolio',          key: 'peakPortfolio'         as const },
                { label: 'Final Portfolio',         key: 'finalPortfolio'        as const },
                { label: 'Avg Annual Tax (Retirement)', key: 'avgAnnualTaxRetirement' as const },
              ] as const).map(({ label, key }) => {
                const vals = results.map(r => r?.[key] ?? 0)
                const best = Math.max(...vals)
                return (
                  <tr key={key} className="hover:bg-neutral-50">
                    <td className="px-6 py-3 text-sm font-medium text-neutral-700">{label}</td>
                    {vals.map((val, i) => {
                      const isBest = key !== 'avgAnnualTaxRetirement' ? val === best : val === Math.min(...vals)
                      return (
                        <td key={i} className={`px-6 py-3 text-sm font-semibold ${loading[i] ? 'text-neutral-300' : isBest ? SCENARIO_TEXT[i] : 'text-neutral-600'}`}>
                          {loading[i] ? '…' : formatDollars(val)}
                          {!loading[i] && isBest && <span className="ml-1.5 text-xs font-normal opacity-60">★ best</span>}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              <tr className="hover:bg-neutral-50">
                <td className="px-6 py-3 text-sm font-medium text-neutral-700">Funds Outlast</td>
                {results.map((r, i) => (
                  <td key={i} className={`px-6 py-3 text-sm font-semibold ${loading[i] ? 'text-neutral-300' : r?.fundsOutlast ? 'text-green-600' : 'text-red-600'}`}>
                    {loading[i] ? '…' : r?.fundsOutlast ? 'Yes ✓' : 'No ✗'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart / Table */}
      {(resultA || resultB || resultC) && (
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
            {activeTab === 'chart'
              ? <MultiLineChart results={results} names={names} peak={peakAll} loading={loading} />
              : <ComparisonTable results={results} names={names} loading={loading} />
            }
          </div>
        </div>
      )}

      <p className="mt-8 text-sm text-muted-foreground max-w-3xl">
        Disclaimer: Scenario projections model income tax and investment growth only. They do not model estate tax, state estate tax, property tax, sales tax, or other non-income taxes. For a full estate tax analysis, see{' '}
        <Link href="/my-estate-strategy" className="underline underline-offset-2 hover:text-foreground">
          My Estate Strategy
        </Link>
        .
      </p>
    </div>
  )
}

function ScenarioEditor({
  scenario, onChange, household, colorIdx, onSave, isSaving, saved, isCalculating,
}: {
  scenario: ScenarioOverrides
  onChange: (s: ScenarioOverrides) => void
  household: Household
  colorIdx: number
  onSave: () => void
  isSaving: boolean
  saved: boolean
  isCalculating: boolean
}) {
  const borderColor = colorIdx === 1 ? 'border-blue-500' : 'border-green-500'
  const badgeBg     = colorIdx === 1 ? 'bg-blue-600'     : 'bg-green-600'
  const btnBg       = colorIdx === 1 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'
  const inputClass  = "block w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"

  return (
    <div className={`rounded-2xl border-2 ${borderColor} bg-white p-5`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full ${badgeBg} px-3 py-1 text-xs font-semibold text-white`}>
            {scenario.name}
          </span>
          <input type="text" value={scenario.name}
            onChange={e => onChange({ ...scenario, name: e.target.value })}
            className="text-xs border-b border-dashed border-neutral-300 bg-transparent text-neutral-500 focus:outline-none focus:border-neutral-500 w-28"
            placeholder="Rename…" />
        </div>
        <button onClick={onSave} disabled={isSaving}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 transition ${btnBg}`}>
          {isSaving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">{displayPersonFirstName(household.person1_name, 'Person 1')} Retire Age</label>
            <input type="number" min={50} max={80} value={scenario.person1_retirement_age}
              onChange={e => onChange({ ...scenario, person1_retirement_age: Number(e.target.value) })}
              className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">{displayPersonFirstName(household.person1_name, 'Person 1')} SS Age</label>
            <input type="number" min={62} max={70} value={scenario.person1_ss_claiming_age}
              onChange={e => onChange({ ...scenario, person1_ss_claiming_age: Number(e.target.value) })}
              className={inputClass} />
          </div>
        </div>

        {household.has_spouse && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">{displayPersonFirstName(household.person2_name, 'Person 2')} Retire Age</label>
              <input type="number" min={50} max={80} value={scenario.person2_retirement_age ?? 65}
                onChange={e => onChange({ ...scenario, person2_retirement_age: Number(e.target.value) })}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">{displayPersonFirstName(household.person2_name, 'Person 2')} SS Age</label>
              <input type="number" min={62} max={70} value={scenario.person2_ss_claiming_age ?? 67}
                onChange={e => onChange({ ...scenario, person2_ss_claiming_age: Number(e.target.value) })}
                className={inputClass} />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1">Primary State</label>
          <select value={scenario.state_primary} onChange={e => onChange({ ...scenario, state_primary: e.target.value })} className={inputClass}>
            <option value="">None (no state tax)</option>
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

      {isCalculating && <p className="mt-3 text-xs text-neutral-400 animate-pulse">Recalculating…</p>}
    </div>
  )
}

function MultiLineChart({ results, names, peak, loading }: {
  results: (ScenarioResult)[]
  names: string[]
  peak: number
  loading: boolean[]
}) {
  const baseRows = results.find(r => r !== null)?.rows ?? []
  const allAges  = baseRows.map(r => r.age_person1)
  const step     = allAges.length > 40 ? 5 : allAges.length > 25 ? 2 : 1
  const sampled  = allAges.filter((_, i) => i % step === 0)

  return (
    <div className="relative">
      <div className="flex items-end gap-0.5 h-56 w-full px-2">
        {sampled.map((age) => (
          <div key={age} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 hidden group-hover:block whitespace-nowrap rounded-lg bg-neutral-900 px-2 py-1.5 text-xs text-white shadow-lg">
              <p className="font-semibold mb-0.5">Age {age}</p>
              {results.map((r, i) => {
                const row = r?.rows.find(row => row.age_person1 === age)
                return (
                  <p key={i} style={{ color: SCENARIO_COLORS[i] === '#1a1a1a' ? '#fff' : SCENARIO_COLORS[i] }}>
                    {names[i]}: {formatDollars(row?.net_worth ?? 0)}
                  </p>
                )
              })}
            </div>
            <div className="w-full flex items-end gap-px" style={{ height: '200px' }}>
              {results.map((r, i) => {
                const row = r?.rows.find(row => row.age_person1 === age)
                const pct = peak > 0 ? ((row?.net_worth ?? 0) / peak) * 100 : 0
                return (
                  <div key={i} className={`flex-1 rounded-t transition-all ${loading[i] ? 'opacity-30' : ''}`} style={{
                    height: `${Math.max(pct, 1)}%`,
                    backgroundColor: SCENARIO_COLORS[i],
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

function ComparisonTable({ results, names, loading }: {
  results: (ScenarioResult)[]
  names: string[]
  loading: boolean[]
}) {
  const baseRows = results.find(r => r !== null)?.rows ?? []

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
                  {name} Net Worth
                </span>
              </th>
            ))}
            {names.map((name, i) => (
              <th key={`tax-${i}`} className="pb-2 pr-4">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: SCENARIO_COLORS[i] }} />
                  {name} Tax
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {baseRows.map((row) => (
            <tr key={row.age_person1} className={row.age_person1 >= (results[0]?.rows.find(r => r.age_person1 >= 65)?.age_person1 ?? 65) ? 'bg-orange-50/40' : ''}>
              <td className="py-1.5 pr-4 font-medium text-neutral-800">{row.age_person1}</td>
              <td className="py-1.5 pr-4 text-neutral-500">{row.year}</td>
              {results.map((r, i) => {
                const yr        = r?.rows.find(y => y.age_person1 === row.age_person1)
                const allVals   = results.map(res => res?.rows.find(y => y.age_person1 === row.age_person1)?.net_worth ?? 0)
                const isBest    = (yr?.net_worth ?? 0) === Math.max(...allVals)
                return (
                  <td key={i} className={`py-1.5 pr-4 font-semibold ${loading[i] ? 'text-neutral-300' : isBest ? SCENARIO_TEXT[i] : 'text-neutral-600'}`}>
                    {loading[i] ? '…' : formatDollars(yr?.net_worth ?? 0)}
                  </td>
                )
              })}
              {results.map((r, i) => {
                const yr = r?.rows.find(y => y.age_person1 === row.age_person1)
                return (
                  <td key={`tax-${i}`} className={`py-1.5 pr-4 ${loading[i] ? 'text-neutral-300' : 'text-neutral-600'}`}>
                    {loading[i] ? '…' : formatDollars(yr?.tax_total ?? 0)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
