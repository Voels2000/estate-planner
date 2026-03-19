'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ──────────────────────────────────────────────────────────────────────

type StateIncomeTaxRate = {
  id?: string
  state_code: string
  rate_pct: number
  tax_year: number
}

type StateEstateTaxRule = {
  id?: string
  state: string
  min_amount: number
  max_amount: number
  rate_pct: number
  exemption_amount: number
  tax_year: number
}

type FederalEstateBracket = {
  id?: string
  tax_year: number
  min_amount: number
  max_amount: number
  rate_pct: number
}

type IrmaaBracket = {
  id?: string
  tax_year: number
  filing_status: string
  magi_threshold: number
  part_b_surcharge: number
  part_d_surcharge: number
}

type ActiveSection = 'state_income' | 'state_estate' | 'federal_estate' | 'irmaa'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC'
]

const inputClass = "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000).toLocaleString()}K`
  return `$${n.toLocaleString()}`
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TaxRulesTab() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('state_income')
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear())

  // State income tax rates
  const [stateIncomeRates, setStateIncomeRates] = useState<StateIncomeTaxRate[]>([])
  const [loadingStateIncome, setLoadingStateIncome] = useState(false)
  const [savingStateIncome, setSavingStateIncome] = useState<string | null>(null)
  const [savedStateIncome, setSavedStateIncome] = useState<string | null>(null)
  const [addingStateIncome, setAddingStateIncome] = useState(false)
  const [newStateIncome, setNewStateIncome] = useState<Partial<StateIncomeTaxRate>>({ tax_year: yearFilter })

  // State estate tax rules
  const [stateEstateRules, setStateEstateRules] = useState<StateEstateTaxRule[]>([])
  const [loadingStateEstate, setLoadingStateEstate] = useState(false)
  const [savingStateEstate, setSavingStateEstate] = useState<string | null>(null)
  const [savedStateEstate, setSavedStateEstate] = useState<string | null>(null)
  const [stateEstateFilter, setStateEstateFilter] = useState<string>('WA')

  // Federal estate brackets
  const [federalBrackets, setFederalBrackets] = useState<FederalEstateBracket[]>([])
  const [loadingFederal, setLoadingFederal] = useState(false)
  const [savingFederal, setSavingFederal] = useState<string | null>(null)
  const [savedFederal, setSavedFederal] = useState<string | null>(null)

  // IRMAA
  const [irmaaBrackets, setIrmaaBrackets] = useState<IrmaaBracket[]>([])
  const [loadingIrmaa, setLoadingIrmaa] = useState(false)
  const [savingIrmaa, setSavingIrmaa] = useState<string | null>(null)
  const [savedIrmaa, setSavedIrmaa] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadStateIncomeRates = useCallback(async (year: number) => {
    setLoadingStateIncome(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('state_income_tax_rates')
      .select('*')
      .eq('tax_year', year)
      .order('state_code')
    setStateIncomeRates(data ?? [])
    setLoadingStateIncome(false)
  }, [])

  const loadStateEstateRules = useCallback(async (year: number, state: string) => {
    setLoadingStateEstate(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('state_estate_tax_rules')
      .select('*')
      .eq('tax_year', year)
      .eq('state', state)
      .order('min_amount')
    setStateEstateRules(data ?? [])
    setLoadingStateEstate(false)
  }, [])

  const loadFederalBrackets = useCallback(async (year: number) => {
    setLoadingFederal(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('federal_estate_tax_brackets')
      .select('*')
      .eq('tax_year', year)
      .order('min_amount')
    setFederalBrackets(data ?? [])
    setLoadingFederal(false)
  }, [])

  const loadIrmaaBrackets = useCallback(async (year: number) => {
    setLoadingIrmaa(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('irmaa_brackets')
      .select('*')
      .eq('tax_year', year)
      .order('filing_status')
      .order('magi_threshold')
    setIrmaaBrackets(data ?? [])
    setLoadingIrmaa(false)
  }, [])

  useEffect(() => { loadStateIncomeRates(yearFilter) }, [yearFilter, loadStateIncomeRates])
  useEffect(() => { loadStateEstateRules(yearFilter, stateEstateFilter) }, [yearFilter, stateEstateFilter, loadStateEstateRules])
  useEffect(() => { loadFederalBrackets(yearFilter) }, [yearFilter, loadFederalBrackets])
  useEffect(() => { loadIrmaaBrackets(yearFilter) }, [yearFilter, loadIrmaaBrackets])

  // ── State Income Tax Handlers ──────────────────────────────────────────────

  async function handleSaveStateIncome(row: StateIncomeTaxRate) {
    const key = `${row.state_code}-${row.tax_year}`
    setSavingStateIncome(key)
    setError(null)
    const supabase = createClient()
    try {
      if (row.id) {
        const { error } = await supabase.from('state_income_tax_rates').update({ rate_pct: row.rate_pct }).eq('id', row.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('state_income_tax_rates').upsert(
          { state_code: row.state_code, rate_pct: row.rate_pct, tax_year: row.tax_year },
          { onConflict: 'state_code,tax_year' }
        )
        if (error) throw error
      }
      setSavedStateIncome(key)
      setTimeout(() => setSavedStateIncome(null), 2000)
      loadStateIncomeRates(yearFilter)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSavingStateIncome(null)
    }
  }

  async function handleAddStateIncome() {
    if (!newStateIncome.state_code || newStateIncome.rate_pct === undefined) return
    setError(null)
    const supabase = createClient()
    try {
      const { error } = await supabase.from('state_income_tax_rates').upsert(
        { state_code: newStateIncome.state_code, rate_pct: newStateIncome.rate_pct, tax_year: newStateIncome.tax_year ?? yearFilter },
        { onConflict: 'state_code,tax_year' }
      )
      if (error) throw error
      setAddingStateIncome(false)
      setNewStateIncome({ tax_year: yearFilter })
      loadStateIncomeRates(yearFilter)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add.')
    }
  }

  // ── State Estate Tax Handlers ──────────────────────────────────────────────

  async function handleSaveStateEstate(row: StateEstateTaxRule) {
    const key = row.id ?? `${row.state}-${row.min_amount}`
    setSavingStateEstate(key)
    setError(null)
    const supabase = createClient()
    try {
      if (row.id) {
        const { error } = await supabase.from('state_estate_tax_rules')
          .update({ min_amount: row.min_amount, max_amount: row.max_amount, rate_pct: row.rate_pct, exemption_amount: row.exemption_amount })
          .eq('id', row.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('state_estate_tax_rules')
          .insert({ state: row.state, min_amount: row.min_amount, max_amount: row.max_amount, rate_pct: row.rate_pct, exemption_amount: row.exemption_amount, tax_year: row.tax_year })
        if (error) throw error
      }
      setSavedStateEstate(key)
      setTimeout(() => setSavedStateEstate(null), 2000)
      loadStateEstateRules(yearFilter, stateEstateFilter)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSavingStateEstate(null)
    }
  }

  async function handleAddStateEstateBracket() {
    setError(null)
    const supabase = createClient()
    try {
      const { error } = await supabase.from('state_estate_tax_rules').insert({
        state: stateEstateFilter,
        min_amount: 0,
        max_amount: 99999999,
        rate_pct: 0,
        exemption_amount: 0,
        tax_year: yearFilter,
      })
      if (error) throw error
      loadStateEstateRules(yearFilter, stateEstateFilter)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add bracket.')
    }
  }

  // ── Federal Estate Tax Handlers ────────────────────────────────────────────

  async function handleSaveFederal(row: FederalEstateBracket) {
    const key = row.id ?? `${row.min_amount}`
    setSavingFederal(key)
    setError(null)
    const supabase = createClient()
    try {
      if (row.id) {
        const { error } = await supabase.from('federal_estate_tax_brackets')
          .update({ min_amount: row.min_amount, max_amount: row.max_amount, rate_pct: row.rate_pct })
          .eq('id', row.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('federal_estate_tax_brackets')
          .insert({ tax_year: row.tax_year, min_amount: row.min_amount, max_amount: row.max_amount, rate_pct: row.rate_pct })
        if (error) throw error
      }
      setSavedFederal(key)
      setTimeout(() => setSavedFederal(null), 2000)
      loadFederalBrackets(yearFilter)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSavingFederal(null)
    }
  }

  // ── IRMAA Handlers ─────────────────────────────────────────────────────────

  async function handleSaveIrmaa(row: IrmaaBracket) {
    const key = row.id ?? `${row.filing_status}-${row.magi_threshold}`
    setSavingIrmaa(key)
    setError(null)
    const supabase = createClient()
    try {
      if (row.id) {
        const { error } = await supabase.from('irmaa_brackets')
          .update({ magi_threshold: row.magi_threshold, part_b_surcharge: row.part_b_surcharge, part_d_surcharge: row.part_d_surcharge })
          .eq('id', row.id)
        if (error) throw error
      }
      setSavedIrmaa(key)
      setTimeout(() => setSavedIrmaa(null), 2000)
      loadIrmaaBrackets(yearFilter)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSavingIrmaa(null)
    }
  }

  async function handleCopyIrmaaToYear(targetYear: number) {
    if (!irmaaBrackets.length) return
    setError(null)
    const supabase = createClient()
    try {
      const rows = irmaaBrackets.map(b => ({
        tax_year: targetYear,
        filing_status: b.filing_status,
        magi_threshold: b.magi_threshold,
        part_b_surcharge: b.part_b_surcharge,
        part_d_surcharge: b.part_d_surcharge,
      }))
      console.log('Copying IRMAA rows:', JSON.stringify(rows))
      const { data, error } = await supabase.from('irmaa_brackets').insert(rows).select()
      console.log('IRMAA copy result:', JSON.stringify({ data, error }))
      if (error) throw error
      setYearFilter(targetYear)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy.')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const SECTIONS: { key: ActiveSection; label: string; description: string }[] = [
    { key: 'state_income',  label: 'State Income Tax Rates',   description: 'Flat/effective income tax rate per state. Used in all projections and scenarios.' },
    { key: 'state_estate',  label: 'State Estate Tax Rules',   description: 'Progressive estate tax brackets by state. Select a state to view and edit its brackets.' },
    { key: 'federal_estate', label: 'Federal Estate Tax',      description: 'Federal estate tax brackets used in estate tax calculations.' },
    { key: 'irmaa',         label: 'IRMAA Brackets',           description: 'Medicare premium surcharges by income level. Used in retirement projections.' },
  ]

  const years = [2023, 2024, 2025, 2026]

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      )}

      {/* Year selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-neutral-700">Tax Year:</label>
        <div className="flex gap-1">
          {years.map(y => (
            <button key={y} onClick={() => setYearFilter(y)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                yearFilter === y ? 'bg-neutral-900 text-white' : 'border border-neutral-200 text-neutral-600 hover:border-neutral-400'
              }`}>
              {y}
            </button>
          ))}
        </div>
        <span className="text-xs text-neutral-400 ml-2">Changes apply to all projections and scenarios immediately.</span>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeSection === s.key
                ? 'border-b-2 border-neutral-900 text-neutral-900'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── State Income Tax Rates ───────────────────────────────────────────── */}
      {activeSection === 'state_income' && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-neutral-900">State Income Tax Rates — {yearFilter}</h2>
            <button onClick={() => setAddingStateIncome(true)}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 transition">
              + Add / Update State
            </button>
          </div>
          <p className="text-sm text-neutral-500 mb-5">
            Effective income tax rate per state. These override the built-in fallback rates in all projection engines.
          </p>

          {addingStateIncome && (
            <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-xs font-semibold text-indigo-700 mb-3">Add / Update State Rate for {yearFilter}</p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">State</label>
                  <select value={newStateIncome.state_code ?? ''} onChange={e => setNewStateIncome(p => ({ ...p, state_code: e.target.value }))} className={inputClass}>
                    <option value="">Select…</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Rate (%)</label>
                  <input type="number" step="0.01" min="0" max="20"
                    value={newStateIncome.rate_pct ?? ''}
                    onChange={e => setNewStateIncome(p => ({ ...p, rate_pct: Number(e.target.value) }))}
                    className={inputClass} placeholder="e.g. 7.0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Tax Year</label>
                  <input type="number" value={newStateIncome.tax_year ?? yearFilter}
                    onChange={e => setNewStateIncome(p => ({ ...p, tax_year: Number(e.target.value) }))}
                    className={inputClass} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddStateIncome}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition">
                  Save Rate
                </button>
                <button onClick={() => setAddingStateIncome(false)}
                  className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {loadingStateIncome ? (
            <p className="text-sm text-neutral-400 py-8 text-center animate-pulse">Loading…</p>
          ) : stateIncomeRates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 py-10 text-center">
              <p className="text-sm text-neutral-500">No rates for {yearFilter}.</p>
              <p className="text-xs text-neutral-400 mt-1">Add a state above, or the engine will use built-in fallback rates.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {stateIncomeRates.map(row => {
                const key = `${row.state_code}-${row.tax_year}`
                return (
                  <div key={key} className="rounded-xl border border-neutral-200 p-3 flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-neutral-700 w-8">{row.state_code}</span>
                    <input type="number" step="0.01" min="0" max="20"
                      value={row.rate_pct}
                      onChange={e => setStateIncomeRates(prev => prev.map(r => r.state_code === row.state_code ? { ...r, rate_pct: Number(e.target.value) } : r))}
                      className="w-16 rounded-lg border border-neutral-300 px-2 py-1 text-sm text-center focus:border-neutral-500 focus:outline-none" />
                    <span className="text-xs text-neutral-400">%</span>
                    <button onClick={() => handleSaveStateIncome(row)} disabled={savingStateIncome === key}
                      className="ml-auto rounded-lg bg-neutral-900 px-2 py-1 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition">
                      {savingStateIncome === key ? '…' : savedStateIncome === key ? '✓' : 'Save'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── State Estate Tax Rules ────────────────────────────────────────────── */}
      {activeSection === 'state_estate' && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-neutral-900">State Estate Tax — {yearFilter}</h2>
            <div className="flex items-center gap-2">
              <select value={stateEstateFilter} onChange={e => setStateEstateFilter(e.target.value)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:border-neutral-500">
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={handleAddStateEstateBracket}
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 transition">
                + Add Bracket
              </button>
            </div>
          </div>
          <p className="text-sm text-neutral-500 mb-5">
            Progressive estate tax brackets for <strong>{stateEstateFilter}</strong>. Exemption amount applies to all brackets for this state.
          </p>

          {loadingStateEstate ? (
            <p className="text-sm text-neutral-400 py-8 text-center animate-pulse">Loading…</p>
          ) : stateEstateRules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 py-10 text-center">
              <p className="text-sm text-neutral-500">{stateEstateFilter} has no estate tax rules for {yearFilter}.</p>
              <p className="text-xs text-neutral-400 mt-1">Click "+ Add Bracket" to seed this state&apos;s rules.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stateEstateRules.map((row, idx) => {
                const key = row.id ?? `${row.state}-${row.min_amount}-${idx}`
                return (
                  <div key={key} className="rounded-xl border border-neutral-200 p-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                      <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">Min Amount ($)</label>
                        <input type="number" value={row.min_amount}
                          onChange={e => setStateEstateRules(prev => prev.map((r, i) => i === idx ? { ...r, min_amount: Number(e.target.value) } : r))}
                          className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">Max Amount ($)</label>
                        <input type="number" value={row.max_amount}
                          onChange={e => setStateEstateRules(prev => prev.map((r, i) => i === idx ? { ...r, max_amount: Number(e.target.value) } : r))}
                          className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">Rate (%)</label>
                        <input type="number" step="0.1" min="0" max="30" value={row.rate_pct}
                          onChange={e => setStateEstateRules(prev => prev.map((r, i) => i === idx ? { ...r, rate_pct: Number(e.target.value) } : r))}
                          className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">Exemption ($)</label>
                        <input type="number" value={row.exemption_amount}
                          onChange={e => setStateEstateRules(prev => prev.map((r, i) => i === idx ? { ...r, exemption_amount: Number(e.target.value) } : r))}
                          className={inputClass} />
                        <p className="text-xs text-neutral-400 mt-0.5">{formatAmount(row.exemption_amount)}</p>
                      </div>
                      <div>
                        <button onClick={() => handleSaveStateEstate(row)} disabled={savingStateEstate === key}
                          className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition">
                          {savingStateEstate === key ? 'Saving…' : savedStateEstate === key ? '✓ Saved' : 'Save'}
                        </button>
                      </div>
                    </div>
                    {idx === 0 && (
                      <p className="text-xs text-neutral-400 mt-2">
                        Range: {formatAmount(row.min_amount)} – {formatAmount(row.max_amount)} @ {row.rate_pct}%
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Federal Estate Tax ────────────────────────────────────────────────── */}
      {activeSection === 'federal_estate' && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-neutral-900 mb-1">Federal Estate Tax Brackets — {yearFilter}</h2>
          <p className="text-sm text-neutral-500 mb-5">Progressive federal estate tax brackets. Applied after exemption credit.</p>

          {loadingFederal ? (
            <p className="text-sm text-neutral-400 py-8 text-center animate-pulse">Loading…</p>
          ) : federalBrackets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 py-10 text-center">
              <p className="text-sm text-neutral-500">No federal estate tax brackets for {yearFilter}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {federalBrackets.map((row, idx) => {
                const key = row.id ?? `federal-${row.min_amount}-${idx}`
                return (
                  <div key={key} className="rounded-xl border border-neutral-200 p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                      <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">Min Amount ($)</label>
                        <input type="number" value={row.min_amount}
                          onChange={e => setFederalBrackets(prev => prev.map((r, i) => i === idx ? { ...r, min_amount: Number(e.target.value) } : r))}
                          className={inputClass} />
                        <p className="text-xs text-neutral-400 mt-0.5">{formatAmount(row.min_amount)}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">Max Amount ($)</label>
                        <input type="number" value={row.max_amount}
                          onChange={e => setFederalBrackets(prev => prev.map((r, i) => i === idx ? { ...r, max_amount: Number(e.target.value) } : r))}
                          className={inputClass} />
                        <p className="text-xs text-neutral-400 mt-0.5">{formatAmount(row.max_amount)}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">Rate (%)</label>
                        <input type="number" step="0.1" min="0" max="50" value={row.rate_pct}
                          onChange={e => setFederalBrackets(prev => prev.map((r, i) => i === idx ? { ...r, rate_pct: Number(e.target.value) } : r))}
                          className={inputClass} />
                      </div>
                      <div>
                        <button onClick={() => handleSaveFederal(row)} disabled={savingFederal === key}
                          className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition">
                          {savingFederal === key ? 'Saving…' : savedFederal === key ? '✓ Saved' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── IRMAA ─────────────────────────────────────────────────────────────── */}
      {activeSection === 'irmaa' && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-neutral-900">IRMAA Brackets — {yearFilter}</h2>
            <button onClick={() => handleCopyIrmaaToYear(yearFilter + 1)}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition">
              Copy to {yearFilter + 1}
            </button>
          </div>
          <p className="text-sm text-neutral-500 mb-5">
            Medicare Part B and Part D surcharges by MAGI threshold. Applied to retirement projections.
            Use "Copy to {yearFilter + 1}" to duplicate this year&apos;s brackets and then update thresholds/surcharges.
          </p>

          {loadingIrmaa ? (
            <p className="text-sm text-neutral-400 py-8 text-center animate-pulse">Loading…</p>
          ) : irmaaBrackets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 py-10 text-center">
              <p className="text-sm text-neutral-500">No IRMAA brackets for {yearFilter}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {['single', 'married_joint'].map(fs => {
                const rows = irmaaBrackets.filter(b => b.filing_status === fs)
                return (
                  <div key={fs}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">
                      {fs === 'married_joint' ? 'Married Filing Jointly' : 'Single'}
                    </h3>
                    {rows.map((row, idx) => {
                      const key = row.id ?? `irmaa-${fs}-${row.magi_threshold}`
                      return (
                        <div key={key} className="rounded-xl border border-neutral-200 p-3 mb-2">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                            <div>
                              <label className="block text-xs font-medium text-neutral-500 mb-1">MAGI Threshold ($)</label>
                              <input type="number" value={row.magi_threshold}
                                onChange={e => setIrmaaBrackets(prev => prev.map(r => r.id === row.id ? { ...r, magi_threshold: Number(e.target.value) } : r))}
                                className={inputClass} />
                              <p className="text-xs text-neutral-400 mt-0.5">{formatAmount(row.magi_threshold)}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-neutral-500 mb-1">Part B Surcharge ($/mo)</label>
                              <input type="number" step="0.10" value={row.part_b_surcharge}
                                onChange={e => setIrmaaBrackets(prev => prev.map(r => r.id === row.id ? { ...r, part_b_surcharge: Number(e.target.value) } : r))}
                                className={inputClass} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-neutral-500 mb-1">Part D Surcharge ($/mo)</label>
                              <input type="number" step="0.10" value={row.part_d_surcharge}
                                onChange={e => setIrmaaBrackets(prev => prev.map(r => r.id === row.id ? { ...r, part_d_surcharge: Number(e.target.value) } : r))}
                                className={inputClass} />
                            </div>
                            <div>
                              <button onClick={() => handleSaveIrmaa(row)} disabled={savingIrmaa === key}
                                className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition">
                                {savingIrmaa === key ? 'Saving…' : savedIrmaa === key ? '✓ Saved' : 'Save'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
