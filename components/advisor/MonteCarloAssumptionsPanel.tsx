'use client'

/**
 * Advisor Monte Carlo assumptions panel.
 *
 * Manages scenario CRUD/share state and assumption comparisons for advisor-driven
 * consumer Monte Carlo recommendation workflows.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { MONTE_CARLO_SYSTEM_DEFAULTS, type MonteCarloAssumptions } from '@/lib/calculations/monteCarlo'

interface ScenarioRow {
  id: string
  scenario_name: string
  is_active: boolean
  shared_at: string | null
  accepted_by_client: boolean
  return_mean_pct: number | null
  volatility_pct: number | null
  withdrawal_rate_pct: number | null
  success_threshold: number | null
  simulation_count: number | null
  planning_horizon_yr: number | null
  inflation_rate_pct: number | null
}

interface MonteCarloAssumptionsPanelProps {
  householdId: string
  grossEstate: number
  onAssumptionsChange?: (assumptions: MonteCarloAssumptions | null) => void
}

interface CompareResult {
  successRate: number
  medianEndValue: number
  p10EndValue: number
  p90EndValue: number
}

const FIELDS: Array<{
  key: keyof MonteCarloAssumptions
  dbKey: keyof ScenarioRow
  label: string
  min: number
  max: number
  step: number
  suffix?: string
}> = [
  { key: 'returnMeanPct', dbKey: 'return_mean_pct', label: 'Expected Annual Return', min: 2, max: 12, step: 0.25, suffix: '%' },
  { key: 'volatilityPct', dbKey: 'volatility_pct', label: 'Annual Volatility', min: 5, max: 25, step: 0.5, suffix: '%' },
  { key: 'withdrawalRatePct', dbKey: 'withdrawal_rate_pct', label: 'Annual Withdrawal Rate', min: 1, max: 8, step: 0.25, suffix: '%' },
  { key: 'successThreshold', dbKey: 'success_threshold', label: 'Success Rate Target', min: 50, max: 99, step: 1, suffix: '%' },
  { key: 'simulationCount', dbKey: 'simulation_count', label: 'Simulation Runs', min: 500, max: 10000, step: 500 },
  { key: 'planningHorizonYr', dbKey: 'planning_horizon_yr', label: 'Planning Horizon', min: 10, max: 50, step: 1, suffix: 'yrs' },
  { key: 'inflationRatePct', dbKey: 'inflation_rate_pct', label: 'Inflation Assumption', min: 1, max: 6, step: 0.25, suffix: '%' },
]

function fromScenario(row: ScenarioRow | null): MonteCarloAssumptions {
  if (!row) return { ...MONTE_CARLO_SYSTEM_DEFAULTS }
  return {
    returnMeanPct: row.return_mean_pct ?? MONTE_CARLO_SYSTEM_DEFAULTS.returnMeanPct,
    volatilityPct: row.volatility_pct ?? MONTE_CARLO_SYSTEM_DEFAULTS.volatilityPct,
    withdrawalRatePct: row.withdrawal_rate_pct ?? MONTE_CARLO_SYSTEM_DEFAULTS.withdrawalRatePct,
    successThreshold: row.success_threshold ?? MONTE_CARLO_SYSTEM_DEFAULTS.successThreshold,
    simulationCount: row.simulation_count ?? MONTE_CARLO_SYSTEM_DEFAULTS.simulationCount,
    planningHorizonYr: row.planning_horizon_yr ?? MONTE_CARLO_SYSTEM_DEFAULTS.planningHorizonYr,
    inflationRatePct: row.inflation_rate_pct ?? MONTE_CARLO_SYSTEM_DEFAULTS.inflationRatePct,
  }
}

const fmtPct = (n: number) => `${n.toFixed(1)}%`
const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`

export default function MonteCarloAssumptionsPanel({
  householdId,
  grossEstate,
  onAssumptionsChange,
}: MonteCarloAssumptionsPanelProps) {
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([])
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('Base Case')
  const [draftValues, setDraftValues] = useState<MonteCarloAssumptions>({ ...MONTE_CARLO_SYSTEM_DEFAULTS })
  const [errors, setErrors] = useState<Partial<Record<keyof MonteCarloAssumptions, string>>>({})
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [baseResult, setBaseResult] = useState<CompareResult | null>(null)
  const [advisorResult, setAdvisorResult] = useState<CompareResult | null>(null)
  const isDirty = useMemo(() => JSON.stringify(draftValues) !== JSON.stringify(MONTE_CARLO_SYSTEM_DEFAULTS), [draftValues])

  const loadScenarios = useCallback(async () => {
    const res = await fetch(`/api/advisor/monte-carlo-assumptions?clientHouseholdId=${householdId}`)
    if (!res.ok) return
    const data = await res.json()
    const rows: ScenarioRow[] = data.scenarios ?? []
    setScenarios(rows)
    const active = rows.find((s) => s.is_active) ?? null
    if (active) {
      setActiveScenarioId(active.id)
      setDraftName(active.scenario_name)
      const assumptions = fromScenario(active)
      setDraftValues(assumptions)
      onAssumptionsChange?.(assumptions)
    } else {
      onAssumptionsChange?.(null)
    }
  }, [householdId, onAssumptionsChange])

  useEffect(() => {
    loadScenarios()
  }, [loadScenarios])

  function validate(values: MonteCarloAssumptions) {
    const next: Partial<Record<keyof MonteCarloAssumptions, string>> = {}
    for (const f of FIELDS) {
      const v = Number(values[f.key])
      if (v < f.min || v > f.max) next[f.key] = `Must be ${f.min}-${f.max}`
    }
    if (values.returnMeanPct - values.inflationRatePct <= 0) {
      next.returnMeanPct = 'Real return must be positive'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSave() {
    if (!validate(draftValues)) return
    setIsSaving(true)
    setGlobalError(null)
    try {
      const res = await fetch('/api/advisor/monte-carlo-assumptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientHouseholdId: householdId,
          scenarioName: draftName,
          returnMeanPct: draftValues.returnMeanPct,
          volatilityPct: draftValues.volatilityPct,
          withdrawalRatePct: draftValues.withdrawalRatePct,
          successThreshold: draftValues.successThreshold,
          simulationCount: draftValues.simulationCount,
          planningHorizonYr: draftValues.planningHorizonYr,
          inflationRatePct: draftValues.inflationRatePct,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGlobalError(data.error ?? 'Save failed')
        return
      }
      if (data.scenario?.id) {
        await fetch('/api/advisor/monte-carlo-assumptions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: data.scenario.id, action: 'activate' }),
        })
      }
      await loadScenarios()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRun() {
    if (!validate(draftValues)) return
    setIsRunning(true)
    setBaseResult(null)
    setAdvisorResult(null)
    try {
      const [baseRes, advRes] = await Promise.all([
        fetch('/api/projection/monte-carlo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            householdId,
            grossEstate,
            assumptions: MONTE_CARLO_SYSTEM_DEFAULTS,
          }),
        }),
        fetch('/api/projection/monte-carlo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            householdId,
            grossEstate,
            assumptions: draftValues,
          }),
        }),
      ])
      if (baseRes.ok) setBaseResult(await baseRes.json())
      if (advRes.ok) setAdvisorResult(await advRes.json())
    } finally {
      setIsRunning(false)
    }
  }

  async function handleShare() {
    if (!activeScenarioId) return
    const res = await fetch('/api/advisor/monte-carlo-assumptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: activeScenarioId, action: 'share' }),
    })
    if (res.ok) {
      setShareMessage('Shared with client.')
      await loadScenarios()
      setTimeout(() => setShareMessage(null), 3000)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <label className="text-xs text-gray-500">Scenario Name</label>
          <input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="mt-1 w-full rounded border border-gray-200 px-3 py-1.5 text-sm" />
        </div>
        {scenarios.length > 0 && (
          <div>
            <label className="text-xs text-gray-500">Saved Scenarios</label>
            <select
              value={activeScenarioId ?? ''}
              onChange={(e) => {
                const id = e.target.value
                const row = scenarios.find((s) => s.id === id) ?? null
                setActiveScenarioId(id || null)
                setDraftValues(fromScenario(row))
                setDraftName(row?.scenario_name ?? 'Base Case')
                onAssumptionsChange?.(row ? fromScenario(row) : null)
              }}
              className="mt-1 rounded border border-gray-200 px-3 py-1.5 text-sm"
            >
              <option value="">System default</option>
              {scenarios.map((s) => <option key={s.id} value={s.id}>{s.scenario_name}{s.is_active ? ' (active)' : ''}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-xs text-gray-500">{f.label}</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={f.min}
                max={f.max}
                step={f.step}
                value={draftValues[f.key]}
                onChange={(e) => {
                  const next = { ...draftValues, [f.key]: Number(e.target.value) }
                  setDraftValues(next)
                  validate(next)
                }}
                className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm"
              />
              {f.suffix && <span className="text-xs text-gray-400">{f.suffix}</span>}
            </div>
            {errors[f.key] && <p className="mt-1 text-xs text-red-600">{errors[f.key]}</p>}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={handleSave} disabled={isSaving || !!globalError} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
          {isSaving ? 'Saving…' : 'Save Scenario'}
        </button>
        <button onClick={handleRun} disabled={isRunning} className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700">
          {isRunning ? 'Running…' : 'Run Comparison'}
        </button>
        <button onClick={handleShare} disabled={!activeScenarioId} className="rounded border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 disabled:opacity-60">
          Share with Client
        </button>
        <button onClick={() => setDraftValues({ ...MONTE_CARLO_SYSTEM_DEFAULTS })} className="text-xs text-gray-500 hover:text-gray-700">
          Reset defaults
        </button>
        {isDirty && <span className="text-xs rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Unsaved changes</span>}
      </div>

      {globalError && <p className="text-xs text-red-600">{globalError}</p>}
      {shareMessage && <p className="text-xs text-green-700">{shareMessage}</p>}

      {baseResult && advisorResult && (
        <div className="rounded border border-gray-200">
          <div className="grid grid-cols-2 divide-x divide-gray-200">
            <div className="p-3">
              <p className="text-xs font-semibold text-gray-600">Base (system defaults)</p>
              <p className="text-xs text-gray-500 mt-1">Success: <span className="font-medium">{fmtPct(baseResult.successRate)}</span></p>
              <p className="text-xs text-gray-500">Median end: <span className="font-medium">{fmtM(baseResult.medianEndValue)}</span></p>
            </div>
            <div className="p-3">
              <p className="text-xs font-semibold text-indigo-700">Advisor scenario</p>
              <p className="text-xs text-gray-500 mt-1">Success: <span className="font-medium">{fmtPct(advisorResult.successRate)}</span></p>
              <p className="text-xs text-gray-500">Median end: <span className="font-medium">{fmtM(advisorResult.medianEndValue)}</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
