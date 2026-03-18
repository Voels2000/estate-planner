'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type UserOption = { id: string; email: string; full_name: string | null }

type DebugTrace = {
  engine: string
  icon: string
  inputs: Record<string, unknown>
  steps: { label: string; value: unknown; note?: string }[]
  outputs: Record<string, unknown>
  error?: string
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') {
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
    if (Math.abs(v) >= 1_000) return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    if (Number.isInteger(v)) return v.toString()
    return v.toFixed(2)
  }
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return `[${v.length} items]`
  return JSON.stringify(v)
}

function fmtPct(v: number) { return `${v.toFixed(2)}%` }
function fmtDollars(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

// FS_MAP for filing status normalization
const FS_MAP: Record<string, string> = {
  mfj: 'married_filing_jointly',
  mfs: 'married_filing_separately',
  hoh: 'head_of_household',
  qw: 'married_filing_jointly',
  single: 'single',
}

const FEDERAL_EXEMPTION_2024 = 13_610_000
const TAX_DEFERRED_TYPES = ['traditional_ira', 'traditional_401k']
const ROTH_TYPES = ['roth_ira', 'roth_401k']

export default function DebugTab({ profiles }: { profiles: { id: string; email: string; full_name: string | null }[] }) {
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [isRunning, setIsRunning] = useState(false)
  const [traces, setTraces] = useState<DebugTrace[]>([])
  const [expandedEngine, setExpandedEngine] = useState<string | null>(null)
  const [expandedStep, setExpandedStep] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runDebug() {
    if (!selectedUserId) return
    setIsRunning(true)
    setError(null)
    setTraces([])

    try {
      const supabase = createClient()

      // Fetch all data for selected user
      const [
        { data: household },
        { data: assets },
        { data: liabilities },
        { data: income },
        { data: expenses },
        { data: federalBrackets },
        { data: estateBrackets },
        { data: stateRates },
        { data: irmaa },
        { data: rmdTable },
      ] = await Promise.all([
        supabase.from('households').select('*').eq('owner_id', selectedUserId).single(),
        supabase.from('assets').select('*').eq('owner_id', selectedUserId),
        supabase.from('liabilities').select('*').eq('owner_id', selectedUserId),
        supabase.from('income').select('*').eq('owner_id', selectedUserId),
        supabase.from('expenses').select('*').eq('owner_id', selectedUserId),
        supabase.from('federal_tax_brackets').select('*').order('bracket_order'),
        supabase.from('federal_estate_tax_brackets').select('*').order('min_amount'),
        supabase.from('state_tax_rates').select('*'),
        supabase.from('irmaa_brackets').select('*').eq('tax_year', 2024),
        supabase.from('irs_rmd_tables').select('*').eq('table_type', 'uniform').order('age'),
      ])

      if (!household) throw new Error('No household found for this user.')

      const newTraces: DebugTrace[] = []

      // ── ENGINE 1: Income Projection ──────────────────────────────────────
      try {
        const year = selectedYear
        const p1Birth = household.person1_birth_year ?? 1960
        const p1Age = year - p1Birth
        const fs = FS_MAP[household.filing_status] ?? household.filing_status
        const inflationRate = (household.inflation_rate ?? 3) / 100
        const baseYear = new Date().getFullYear()
        const inflFactor = Math.pow(1 + inflationRate, year - baseYear)

        const incomeRows = (income ?? [])
        let salary = 0, ssIncome = 0, otherIncome = 0

        for (const row of incomeRows) {
          const start = row.start_year ?? baseYear
          const end = row.end_year ?? 9999
          if (year < start || year > end) continue
          const amt = row.inflation_adjust ? Number(row.amount) * inflFactor : Number(row.amount)
          if (row.source === 'salary') salary += amt
          else if (row.source === 'social_security') ssIncome += amt
          else otherIncome += amt
        }

        const grossIncome = salary + ssIncome + otherIncome
        const deduction = fs === 'married_filing_jointly' ? 29200 : 14600
        const taxableIncome = Math.max(0, grossIncome - deduction)

        // Federal tax
        const relevantBrackets = (federalBrackets ?? [])
          .filter((b: any) => b.filing_status === fs)
          .sort((a: any, b: any) => a.bracket_order - b.bracket_order)
        let federalTax = 0
        let remaining = taxableIncome
        for (const b of relevantBrackets) {
          if (remaining <= 0) break
          const width = (b.max_amount ?? 1e15) - b.min_amount
          const inBracket = Math.min(remaining, width)
          federalTax += inBracket * (b.rate_pct / 100)
          remaining -= inBracket
        }

        const stateRate = (stateRates ?? []).find((s: any) => s.state_code === household.state_primary)?.rate_pct ?? 0
        const stateTax = taxableIncome * (stateRate / 100)

        newTraces.push({
          engine: 'Income & Tax Projection',
          icon: '💰',
          inputs: {
            user: profiles.find(p => p.id === selectedUserId)?.full_name ?? selectedUserId,
            year: String(year),
            person1_age: p1Age,
            filing_status: household.filing_status,
            state: household.state_primary,
            inflation_rate: `${household.inflation_rate}%`,
            income_rows: incomeRows.length,
          },
          steps: [
            { label: 'Inflation factor', value: inflFactor.toFixed(4), note: `(1 + ${inflationRate})^${year - baseYear}` },
            { label: 'Salary income', value: fmtDollars(salary), note: `From ${incomeRows.filter(r => r.source === 'salary').length} salary row(s)` },
            { label: 'Social Security income', value: fmtDollars(ssIncome), note: `From ${incomeRows.filter(r => r.source === 'social_security').length} SS row(s)` },
            { label: 'Other income (total)', value: fmtDollars(otherIncome), note: incomeRows.filter((r: any) => r.source !== 'salary' && r.source !== 'social_security').map((r: any) => `${r.source}: ${fmtDollars(Number(r.amount))}`).join(', ') || 'None' },
            { label: 'Gross income', value: fmtDollars(grossIncome), note: 'salary + SS + other' },
            { label: 'Standard deduction', value: fmtDollars(deduction), note: fs === 'married_filing_jointly' ? 'MFJ 2024' : 'Single 2024' },
            { label: 'Taxable income', value: fmtDollars(taxableIncome), note: 'gross - deduction (floor 0)' },
            { label: 'Filing status (normalized)', value: fs },
            { label: 'Federal tax brackets matched', value: relevantBrackets.length },
            { label: 'Federal income tax', value: fmtDollars(federalTax) },
            { label: 'State rate', value: fmtPct(stateRate), note: household.state_primary },
            { label: 'State income tax', value: fmtDollars(stateTax) },
          ],
          outputs: {
            gross_income: fmtDollars(grossIncome),
            taxable_income: fmtDollars(taxableIncome),
            federal_tax: fmtDollars(federalTax),
            state_tax: fmtDollars(stateTax),
            total_tax: fmtDollars(federalTax + stateTax),
            net_income: fmtDollars(grossIncome - federalTax - stateTax),
          },
        })
      } catch (e) {
        newTraces.push({ engine: 'Income & Tax Projection', icon: '💰', inputs: {}, steps: [], outputs: {}, error: String(e) })
      }

      // ── ENGINE 2: Asset Projection ────────────────────────────────────────
      try {
        const year = selectedYear
        const p1Birth = household.person1_birth_year ?? 1960
        const p1Age = year - p1Birth
        const isRetired = p1Age >= (household.person1_retirement_age ?? 65)
        const growthRate = isRetired
          ? (household.growth_rate_retirement ?? 5) / 100
          : (household.growth_rate_accumulation ?? 7) / 100

        const assetList = assets ?? []
        const totalAssets = assetList.reduce((s: number, a: any) => s + Number(a.value ?? 0), 0)
        const taxDeferred = assetList.filter((a: any) => TAX_DEFERRED_TYPES.includes(a.type)).reduce((s: number, a: any) => s + Number(a.value), 0)
        const roth = assetList.filter((a: any) => ROTH_TYPES.includes(a.type)).reduce((s: number, a: any) => s + Number(a.value), 0)
        const taxableAssets = totalAssets - taxDeferred - roth

        // RMD for this year
        const rmdRow = (rmdTable ?? []).find((r: any) => r.age === p1Age)
        const rmdFactor = rmdRow?.factor ?? null
        const rmdAmount = rmdFactor && p1Age >= 73 ? Math.round(taxDeferred / rmdFactor) : 0

        newTraces.push({
          engine: 'Asset Projection',
          icon: '📈',
          inputs: {
            year: selectedYear,
            person1_age: p1Age,
            retirement_age: household.person1_retirement_age,
            is_retired: isRetired,
            total_assets: fmtDollars(totalAssets),
            asset_count: assetList.length,
          },
          steps: [
            { label: 'Tax-deferred assets', value: fmtDollars(taxDeferred), note: 'Traditional IRA, 401k' },
            { label: 'Roth assets', value: fmtDollars(roth), note: 'Roth IRA, Roth 401k' },
            { label: 'Taxable assets', value: fmtDollars(taxableAssets), note: 'Brokerage, bank, other' },
            { label: 'Phase', value: isRetired ? 'Retirement' : 'Accumulation' },
            { label: 'Growth rate applied', value: fmtPct(growthRate * 100) },
            { label: 'Projected growth this year', value: fmtDollars(totalAssets * growthRate) },
            { label: 'RMD age threshold', value: '73 (SECURE Act 2.0)' },
            { label: 'RMD applies this year', value: p1Age >= 73 ? 'Yes' : 'No' },
            { label: 'IRS life expectancy factor', value: rmdFactor ?? 'N/A (under 73)' },
            { label: 'RMD amount', value: fmtDollars(rmdAmount), note: rmdFactor ? `${fmtDollars(taxDeferred)} ÷ ${rmdFactor}` : 'Not required' },
          ],
          outputs: {
            total_assets: fmtDollars(totalAssets),
            projected_growth: fmtDollars(totalAssets * growthRate),
            rmd_amount: fmtDollars(rmdAmount),
            projected_end_of_year: fmtDollars(totalAssets * (1 + growthRate) - rmdAmount),
          },
        })
      } catch (e) {
        newTraces.push({ engine: 'Asset Projection', icon: '📈', inputs: {}, steps: [], outputs: {}, error: String(e) })
      }

      // ── ENGINE 3: Federal Estate Tax ──────────────────────────────────────
      try {
        const assetList = assets ?? []
        const liabList = liabilities ?? []
        const grossEstate = assetList.reduce((s: number, a: any) => s + Number(a.value ?? 0), 0)
        const totalLiabilities = liabList.reduce((s: number, l: any) => s + Number(l.balance ?? 0), 0)
        const fs = FS_MAP[household.filing_status] ?? household.filing_status
        const isMfj = fs === 'married_filing_jointly'
        const exemption = isMfj ? FEDERAL_EXEMPTION_2024 * 2 : FEDERAL_EXEMPTION_2024
        const taxableEstate = Math.max(0, grossEstate - totalLiabilities)
        const brackets = (estateBrackets ?? []).sort((a: any, b: any) => a.min_amount - b.min_amount)

        function progressiveTax(base: number) {
          let tax = 0
          for (const b of brackets) {
            if (base <= b.min_amount) break
            const inBracket = Math.min(base, b.max_amount ?? 1e15) - b.min_amount
            if (inBracket > 0) tax += inBracket * (b.rate_pct / 100)
          }
          return Math.round(tax * 100) / 100
        }

        const taxBeforeCredit = progressiveTax(taxableEstate)
        const applicableCredit = progressiveTax(exemption)
        const netEstateTax = Math.max(0, taxBeforeCredit - applicableCredit)

        newTraces.push({
          engine: 'Federal Estate Tax',
          icon: '🏛️',
          inputs: {
            filing_status: household.filing_status,
            gross_estate: fmtDollars(grossEstate),
            total_liabilities: fmtDollars(totalLiabilities),
            asset_count: assetList.length,
            liability_count: liabList.length,
          },
          steps: [
            { label: 'Gross estate', value: fmtDollars(grossEstate), note: 'Sum of all assets' },
            { label: 'Total liabilities', value: fmtDollars(totalLiabilities) },
            { label: 'Taxable estate', value: fmtDollars(taxableEstate), note: 'gross - liabilities' },
            { label: 'Filing status', value: fs },
            { label: 'Federal exemption', value: fmtDollars(exemption), note: isMfj ? 'MFJ = 2× exemption ($27.22M)' : 'Single exemption ($13.61M)' },
            { label: 'Estate exceeds exemption', value: taxableEstate > exemption ? 'YES — tax applies' : 'No — below exemption' },
            { label: 'Tax on taxable estate', value: fmtDollars(taxBeforeCredit) },
            { label: 'Applicable credit (tax on exemption)', value: fmtDollars(applicableCredit) },
            { label: 'Net federal estate tax', value: fmtDollars(netEstateTax), note: 'tax before credit − applicable credit' },
          ],
          outputs: {
            gross_estate: fmtDollars(grossEstate),
            taxable_estate: fmtDollars(taxableEstate),
            exemption: fmtDollars(exemption),
            tax_before_credit: fmtDollars(taxBeforeCredit),
            applicable_credit: fmtDollars(applicableCredit),
            net_estate_tax: fmtDollars(netEstateTax),
          },
        })
      } catch (e) {
        newTraces.push({ engine: 'Federal Estate Tax', icon: '🏛️', inputs: {}, steps: [], outputs: {}, error: String(e) })
      }

      // ── ENGINE 4: RMD ─────────────────────────────────────────────────────
      try {
        const year = selectedYear
        const p1Birth = household.person1_birth_year ?? 1960
        const p1Age = year - p1Birth
        const rmdEligibleAssets = (assets ?? []).filter((a: any) => TAX_DEFERRED_TYPES.includes(a.type))
        const totalTaxDeferred = rmdEligibleAssets.reduce((s: number, a: any) => s + Number(a.value ?? 0), 0)
        const rmdRow = (rmdTable ?? []).find((r: any) => r.age === p1Age)
        const factor = rmdRow?.factor ?? null
        const rmdRequired = p1Age >= 73
        const totalRmd = rmdRequired && factor ? Math.round(totalTaxDeferred / factor) : 0

        newTraces.push({
          engine: 'RMD Calculator',
          icon: '📋',
          inputs: {
            year: String(year),
            person1_birth_year: household.person1_birth_year,
            person1_age: p1Age,
            rmd_eligible_accounts: rmdEligibleAssets.length,
            total_tax_deferred: fmtDollars(totalTaxDeferred),
          },
          steps: [
            { label: 'Person 1 age in selected year', value: p1Age },
            { label: 'RMD start age (SECURE Act 2.0)', value: 73 },
            { label: 'RMD required this year', value: rmdRequired ? 'Yes' : 'No' },
            { label: 'RMD-eligible accounts', value: rmdEligibleAssets.length, note: rmdEligibleAssets.map((a: any) => a.name ?? a.type).join(', ') || 'None' },
            { label: 'Total tax-deferred balance', value: fmtDollars(totalTaxDeferred) },
            { label: 'IRS Uniform Lifetime Factor', value: factor ?? 'N/A', note: factor ? `Age ${p1Age} from IRS table` : 'Age below 73' },
            { label: 'RMD calculation', value: factor ? `${fmtDollars(totalTaxDeferred)} ÷ ${factor}` : 'Not applicable' },
            { label: 'Total RMD amount', value: fmtDollars(totalRmd) },
            { label: 'Per-account RMD', value: rmdEligibleAssets.length > 0 && factor ? fmtDollars(totalRmd / rmdEligibleAssets.length) : '—', note: 'Evenly split across eligible accounts' },
          ],
          outputs: {
            person1_age: p1Age,
            rmd_required: rmdRequired ? 'Yes' : 'No',
            life_expectancy_factor: factor ?? 'N/A',
            total_rmd: fmtDollars(totalRmd),
            eligible_accounts: rmdEligibleAssets.length,
          },
        })
      } catch (e) {
        newTraces.push({ engine: 'RMD Calculator', icon: '📋', inputs: {}, steps: [], outputs: {}, error: String(e) })
      }

      setTraces(newTraces)
      setExpandedEngine(newTraces[0]?.engine ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setIsRunning(false)
    }
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 31 }, (_, i) => currentYear + i)

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-neutral-900 mb-1">Calculation Debugger</h2>
        <p className="text-sm text-neutral-500 mb-5">
          Select a user and year to inspect every intermediate value across all calculation engines.
        </p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">User</label>
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 min-w-64"
            >
              <option value="">Select a user…</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name ?? p.email} — {p.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button
            onClick={runDebug}
            disabled={!selectedUserId || isRunning}
            className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-40 transition"
          >
            {isRunning ? 'Running…' : 'Run Debug'}
          </button>
        </div>
        {error && <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
      </div>

      {/* Results */}
      {traces.length > 0 && (
        <div className="space-y-4">
          {traces.map(trace => (
            <div key={trace.engine} className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
              {/* Engine header */}
              <button
                onClick={() => setExpandedEngine(expandedEngine === trace.engine ? null : trace.engine)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-neutral-50 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{trace.icon}</span>
                  <div className="text-left">
                    <h3 className="text-sm font-semibold text-neutral-900">{trace.engine}</h3>
                    {trace.error ? (
                      <p className="text-xs text-red-600 mt-0.5">Error: {trace.error}</p>
                    ) : (
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {Object.entries(trace.outputs).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-neutral-400 text-sm">{expandedEngine === trace.engine ? '▲' : '▼'}</span>
              </button>

              {expandedEngine === trace.engine && !trace.error && (
                <div className="border-t border-neutral-100">
                  <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-neutral-100">

                    {/* Inputs */}
                    <div className="p-5">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Inputs</h4>
                      <div className="space-y-2">
                        {Object.entries(trace.inputs).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-4">
                            <span className="text-xs text-neutral-500 capitalize">{k.replace(/_/g, ' ')}</span>
                            <span className="text-xs font-medium text-neutral-900 text-right">{fmt(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Steps */}
                    <div className="p-5">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Calculation Steps</h4>
                      <div className="space-y-2">
                        {trace.steps.map((step, i) => (
                          <div key={i} className="rounded-lg bg-neutral-50 px-3 py-2">
                            <div className="flex justify-between gap-2">
                              <span className="text-xs text-neutral-600">{step.label}</span>
                              <span className="text-xs font-semibold text-neutral-900 text-right">{fmt(step.value)}</span>
                            </div>
                            {step.note && <p className="text-[10px] text-neutral-400 mt-0.5">{step.note}</p>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Outputs */}
                    <div className="p-5">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Outputs</h4>
                      <div className="space-y-2">
                        {Object.entries(trace.outputs).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-4 rounded-lg bg-neutral-900 px-3 py-2">
                            <span className="text-xs text-neutral-400 capitalize">{k.replace(/_/g, ' ')}</span>
                            <span className="text-xs font-semibold text-white text-right">{fmt(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {traces.length === 0 && !isRunning && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm font-medium text-neutral-600">Select a user and year, then click Run Debug</p>
          <p className="text-xs text-neutral-400 mt-1">All engine traces will appear here</p>
        </div>
      )}
    </div>
  )
}
