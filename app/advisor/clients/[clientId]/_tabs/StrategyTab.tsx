'use client'
// app/advisor/clients/[clientId]/_tabs/StrategyTab.tsx
// Sprint 59 — StrategyTab base case view

import { useState, useEffect } from 'react'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import { formatCurrency } from '../_utils'
import EstateFlowDiagram from '@/components/estate-flow/EstateFlowDiagram'

type ScenarioId = 'current_law_extended' | 'sunset_2026' | 'legislative_change'
type DeathSequence = 'S1_first' | 'S2_first'

type EstateTaxRow = {
  year: number
  age_person1: number
  age_person2: number | null
  estate_incl_home: number
  estate_excl_home: number
  estate_tax_federal: number
  estate_tax_state: number
  net_to_heirs: number
  taxable_estate: number
  dsue_available: number
}

type ScenarioSummary = {
  scenario_id: ScenarioId
  label: string
  gross_estate: number
  estate_tax_federal: number
  estate_tax_state: number
  net_to_heirs: number
  cost_of_inaction: number
}

type Props = {
  clientId: string
  advisorId: string
  householdId: string
  scenarioId: string | null
  household?: { base_case_scenario_id?: string | null } | null
  person1Name: string
  person2Name: string | null
  hasSpouse: boolean
}

const SCENARIO_LABELS: Record<ScenarioId, string> = {
  current_law_extended: 'Current Law Extended',
  sunset_2026: 'Sunset 2026',
  legislative_change: 'Legislative Change',
}

export default function StrategyTab({
  clientId,
  advisorId,
  householdId,
  scenarioId,
  household,
  person1Name,
  person2Name,
  hasSpouse,
}: Props) {
  const [activeScenario, setActiveScenario] = useState<ScenarioId>('current_law_extended')
  const [activeSequence, setActiveSequence] = useState<DeathSequence>('S1_first')
  const [rows, setRows] = useState<EstateTaxRow[]>([])
  const [summaries, setSummaries] = useState<ScenarioSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadScenario()
  }, [clientId, activeScenario, activeSequence])

  async function loadScenario() {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/advisor/strategy-tab?clientId=${clientId}&scenario=${activeScenario}&sequence=${activeSequence}`
      )
      if (!res.ok) {
        const data = await res.json()
        if (data.error === 'no_scenario') {
          setRows([])
          setSummaries([])
          setIsLoading(false)
          return
        }
        throw new Error(data.error ?? 'Failed to load')
      }
      const data = await res.json()
      setRows(data.rows ?? [])
      setSummaries(data.summaries ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load strategy data')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGenerateBaseCase() {
    setIsGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/advisor/generate-base-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate')
      await loadScenario()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate base case')
    } finally {
      setIsGenerating(false)
    }
  }

  const currentSummary = summaries.find(s => s.scenario_id === activeScenario)
  const baselineTax = summaries.find(s => s.scenario_id === 'current_law_extended')
  const costOfInaction = currentSummary
    ? currentSummary.estate_tax_federal + currentSummary.estate_tax_state
    : 0
  console.log('StrategyTab household:', household)
  console.log('StrategyTab base_case_scenario_id:', household?.base_case_scenario_id)
  console.log('EstateFlowDiagram scenarioId:', household?.base_case_scenario_id)

  const peak = Math.max(...rows.map(r => r.estate_incl_home), 1)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-slate-400">Loading strategy data...</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-4xl mb-3">📈</div>
        <p className="text-sm font-medium text-slate-600">No base case scenario yet</p>
        <p className="text-xs text-slate-400 mt-1 mb-6">
          Generate the base case projection to see estate tax exposure across all 3 law scenarios.
        </p>
        {error && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </p>
        )}
        <button
          onClick={handleGenerateBaseCase}
          disabled={isGenerating}
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {isGenerating ? 'Generating...' : 'Generate Base Case →'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Scenario + sequence controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {(Object.keys(SCENARIO_LABELS) as ScenarioId[]).map(id => (
            <button
              key={id}
              onClick={() => setActiveScenario(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeScenario === id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {SCENARIO_LABELS[id]}
            </button>
          ))}
        </div>
        {hasSpouse && (
          <div className="flex gap-2">
            <button
              onClick={() => setActiveSequence('S1_first')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeSequence === 'S1_first'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {person1Name} dies first
            </button>
            <button
              onClick={() => setActiveSequence('S2_first')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeSequence === 'S2_first'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {person2Name ?? 'Spouse'} dies first
            </button>
          </div>
        )}
        <button
          onClick={handleGenerateBaseCase}
          disabled={isGenerating}
          className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 disabled:opacity-50 transition"
        >
          {isGenerating ? 'Recalculating...' : '↻ Recalculate'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Gross Estate"
          value={formatCurrency(currentSummary?.gross_estate ?? 0)}
          sub="At final death"
        />
        <SummaryCard
          label="Federal Estate Tax"
          value={formatCurrency(currentSummary?.estate_tax_federal ?? 0)}
          sub={SCENARIO_LABELS[activeScenario]}
          highlight="red"
        />
        <SummaryCard
          label="Net to Heirs"
          value={formatCurrency(currentSummary?.net_to_heirs ?? 0)}
          sub="After all taxes"
          highlight="green"
        />
        <SummaryCard
          label="Cost of Inaction"
          value={currentSummary?.cost_of_inaction
            ? formatCurrency(currentSummary.cost_of_inaction)
            : '—'}
          sub="vs best scenario"
          highlight="amber"
        />
      </div>

      {/* ── Estate growth line chart ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Estate Value Over Time — {SCENARIO_LABELS[activeScenario]}
        </h3>
        <EstateLineChart rows={rows} peak={peak} />
      </div>

      {/* ── Scenario comparison table ── */}
      {summaries.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">3-Scenario Comparison</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Scenario</th>
                <th className="text-right text-xs font-semibold text-slate-500 py-3">Gross Estate</th>
                <th className="text-right text-xs font-semibold text-slate-500 py-3">Federal Tax</th>
                <th className="text-right text-xs font-semibold text-slate-500 py-3">State Tax</th>
                <th className="text-right text-xs font-semibold text-slate-500 py-3 pr-5">Net to Heirs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {summaries.map(s => (
                <tr
                  key={s.scenario_id}
                  className={`hover:bg-slate-50 ${activeScenario === s.scenario_id ? 'bg-indigo-50/50' : ''}`}
                >
                  <td className="px-5 py-3 font-medium text-slate-800">{s.label}</td>
                  <td className="py-3 text-right text-slate-700">{formatCurrency(s.gross_estate)}</td>
                  <td className="py-3 text-right text-red-600 font-medium">{formatCurrency(s.estate_tax_federal)}</td>
                  <td className="py-3 text-right text-amber-600">{formatCurrency(s.estate_tax_state)}</td>
                  <td className="py-3 pr-5 text-right text-emerald-700 font-medium">{formatCurrency(s.net_to_heirs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Year-by-year table ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Year-by-Year Estate Projection</h3>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b border-slate-100">
              <tr>
                <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Year</th>
                <th className="text-left text-xs font-semibold text-slate-500 py-3">Age</th>
                <th className="text-right text-xs font-semibold text-slate-500 py-3">Gross Estate</th>
                <th className="text-right text-xs font-semibold text-slate-500 py-3">Taxable Estate</th>
                <th className="text-right text-xs font-semibold text-slate-500 py-3">Fed Tax</th>
                <th className="text-right text-xs font-semibold text-slate-500 py-3">State Tax</th>
                <th className="text-right text-xs font-semibold text-slate-500 py-3 pr-5">Net to Heirs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.filter((_, i) => i % 2 === 0 || rows[i].estate_tax_federal > 0).map(row => (
                <tr
                  key={row.year}
                  className={`hover:bg-slate-50 ${row.estate_tax_federal > 0 ? 'bg-red-50/30' : ''}`}
                >
                  <td className="px-5 py-2.5 font-medium text-slate-700">{row.year}</td>
                  <td className="py-2.5 text-slate-500">
                    {row.age_person1}{row.age_person2 ? ` / ${row.age_person2}` : ''}
                  </td>
                  <td className="py-2.5 text-right text-slate-700">{formatCurrency(row.estate_incl_home)}</td>
                  <td className="py-2.5 text-right text-slate-600">{formatCurrency(row.taxable_estate)}</td>
                  <td className={`py-2.5 text-right font-medium ${row.estate_tax_federal > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    {row.estate_tax_federal > 0 ? formatCurrency(row.estate_tax_federal) : '—'}
                  </td>
                  <td className={`py-2.5 text-right ${row.estate_tax_state > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {row.estate_tax_state > 0 ? formatCurrency(row.estate_tax_state) : '—'}
                  </td>
                  <td className="py-2.5 pr-5 text-right text-emerald-700 font-medium">
                    {formatCurrency(row.net_to_heirs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 pt-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Estate Flow Diagram</h3>
        </div>
        <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-0 overflow-x-auto pb-5">
          <div className="min-w-[1100px] px-4">
            <EstateFlowDiagram
              householdId={householdId}
              scenarioId={household?.base_case_scenario_id ?? null}
              advisorId={advisorId}
              isAdvisor={true}
            />
          </div>
        </div>
      </div>

      <DisclaimerBanner context="estate projection" />
    </div>
  )
}

// ── Line chart ────────────────────────────────────────────────────────────────

function EstateLineChart({ rows, peak }: { rows: EstateTaxRow[]; peak: number }) {
  const step = rows.length > 40 ? 5 : rows.length > 25 ? 2 : 1
  const sampled = rows.filter((_, i) => i % step === 0)
  const height = 180

  return (
    <div className="flex items-end gap-0.5 w-full overflow-x-auto" style={{ height: height + 24 }}>
      {sampled.map(r => {
        const pct = peak > 0 ? (r.estate_incl_home / peak) * 100 : 0
        const taxPct = peak > 0 ? ((r.estate_tax_federal + r.estate_tax_state) / peak) * 100 : 0
        return (
          <div key={r.year} className="flex-1 flex flex-col items-center gap-1 group min-w-[12px]">
            <div className="relative w-full flex flex-col items-end justify-end" style={{ height }}>
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 hidden group-hover:block whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white shadow-lg">
                {r.year}: {formatCurrency(r.estate_incl_home)}
                {r.estate_tax_federal > 0 && ` · Tax: ${formatCurrency(r.estate_tax_federal)}`}
              </div>
              {/* Estate tax portion — red */}
              {taxPct > 0 && (
                <div
                  className="w-full bg-red-400 rounded-t"
                  style={{ height: `${taxPct}%` }}
                />
              )}
              {/* Net to heirs portion — green */}
              <div
                className="w-full bg-indigo-400"
                style={{ height: `${Math.max(pct - taxPct, 1)}%` }}
              />
            </div>
            <span className="text-[9px] text-slate-400">{r.age_person1}</span>
          </div>
        )
      })}
    </div>
  )
}

function SummaryCard({ label, value, sub, highlight }: {
  label: string; value: string; sub?: string; highlight?: 'green' | 'red' | 'amber'
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${
        highlight === 'green' ? 'text-emerald-600' :
        highlight === 'red' ? 'text-red-600' :
        highlight === 'amber' ? 'text-amber-600' :
        'text-slate-800'
      }`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}
