'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AdvisorPresetRow } from '@/lib/advisor/advisorPresetAssumptions'

type PresetFormState = {
  scenario_name: string
  returnMeanPct: string
  inflationRatePct: string
  volatilityPct: string
  simulationCount: string
  planningHorizonYr: string
  withdrawalRatePct: string
  notes: string
  is_default: boolean
}

const emptyForm = (): PresetFormState => ({
  scenario_name: '',
  returnMeanPct: '',
  inflationRatePct: '',
  volatilityPct: '',
  simulationCount: '1000',
  planningHorizonYr: '',
  withdrawalRatePct: '',
  notes: '',
  is_default: false,
})

function formFromPreset(row: AdvisorPresetRow): PresetFormState {
  return {
    scenario_name: row.scenario_name,
    returnMeanPct: row.return_mean_pct != null ? String(row.return_mean_pct) : '',
    inflationRatePct: row.inflation_rate_pct != null ? String(row.inflation_rate_pct) : '',
    volatilityPct: row.volatility_pct != null ? String(row.volatility_pct) : '',
    simulationCount:
      row.simulation_count != null ? String(row.simulation_count) : '',
    planningHorizonYr:
      row.planning_horizon_yr != null ? String(row.planning_horizon_yr) : '',
    withdrawalRatePct:
      row.withdrawal_rate_pct != null ? String(row.withdrawal_rate_pct) : '',
    notes: row.notes ?? '',
    is_default: row.is_default,
  }
}

function optionalNum(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

function formatPresetSummary(row: AdvisorPresetRow): string {
  const parts: string[] = []
  if (row.return_mean_pct != null) parts.push(`Return ${row.return_mean_pct}%`)
  if (row.inflation_rate_pct != null) parts.push(`Inflation ${row.inflation_rate_pct}%`)
  if (row.volatility_pct != null) parts.push(`Vol ${row.volatility_pct}%`)
  if (row.simulation_count != null) parts.push(`${row.simulation_count} sim`)
  return parts.length > 0 ? parts.join(' · ') : 'System defaults for unset fields'
}

export function PresetManager() {
  const [presets, setPresets] = useState<AdvisorPresetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<PresetFormState>(emptyForm())

  const loadPresets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/advisor/presets')
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to load presets')
        return
      }
      setPresets(data.presets ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load presets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPresets()
  }, [loadPresets])

  function openNew() {
    setEditingId(null)
    setForm(emptyForm())
    setShowForm(true)
    setError(null)
  }

  function openEdit(row: AdvisorPresetRow) {
    setEditingId(row.id)
    setForm(formFromPreset(row))
    setShowForm(true)
    setError(null)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm())
  }

  function buildBody() {
    return {
      scenario_name: form.scenario_name.trim(),
      is_default: form.is_default,
      returnMeanPct: optionalNum(form.returnMeanPct),
      inflationRatePct: optionalNum(form.inflationRatePct),
      volatilityPct: optionalNum(form.volatilityPct),
      simulationCount: optionalNum(form.simulationCount),
      planningHorizonYr: optionalNum(form.planningHorizonYr),
      withdrawalRatePct: optionalNum(form.withdrawalRatePct),
      notes: form.notes.trim() || null,
    }
  }

  async function handleSave() {
    if (!form.scenario_name.trim()) {
      setError('Preset name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body = buildBody()
      const res = editingId
        ? await fetch(`/api/advisor/presets/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/advisor/presets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Save failed')
        return
      }
      cancelForm()
      await loadPresets()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this preset?')) return
    setError(null)
    const res = await fetch(`/api/advisor/presets/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Delete failed')
      return
    }
    if (editingId === id) cancelForm()
    await loadPresets()
  }

  async function handleSetDefault(id: string) {
    setError(null)
    const res = await fetch(`/api/advisor/presets/${id}/default`, { method: 'PATCH' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Could not set default')
      return
    }
    await loadPresets()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">My Assumption Presets</h2>
          <p className="text-sm text-gray-500 mt-1">
            Reusable Monte Carlo assumptions for client recommendations.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="rounded-lg bg-[var(--mwm-navy)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--mwm-navy-light)]"
        >
          + New Preset
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {showForm && (
        <div className="rounded-xl border border-[color:var(--mwm-border)] bg-[var(--mwm-gold-pale)]/40 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {editingId ? 'Edit preset' : 'New preset'}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Preset name *</label>
              <input
                value={form.scenario_name}
                onChange={(e) => setForm((f) => ({ ...f, scenario_name: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
              />
            </div>
            {[
              { key: 'returnMeanPct' as const, label: 'Expected return (%)' },
              { key: 'inflationRatePct' as const, label: 'Inflation rate (%)' },
              { key: 'volatilityPct' as const, label: 'Volatility (%)' },
              { key: 'simulationCount' as const, label: 'Simulation count' },
              { key: 'planningHorizonYr' as const, label: 'Planning horizon (yr)' },
              { key: 'withdrawalRatePct' as const, label: 'Withdrawal rate (%)' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 block mb-1">{label}</label>
                <input
                  type="number"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
                  placeholder="Optional"
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
              />
            </div>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
                className="rounded"
              />
              Set as default
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-lg bg-[var(--mwm-navy)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Preset'}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading presets…</p>
      ) : presets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-sm text-gray-500">
          No presets yet. Create your first preset to speed up client recommendations.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
          {presets.map((row) => (
            <div key={row.id} className="px-4 py-4 flex flex-wrap gap-4 justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  {row.is_default && (
                    <span className="text-amber-500" aria-hidden>
                      ★
                    </span>
                  )}
                  {row.scenario_name}
                </p>
                <p className="text-xs text-gray-600 mt-1">{formatPresetSummary(row)}</p>
                {row.is_default ? (
                  <p className="text-xs text-green-700 mt-1">
                    Default — loaded automatically for new client scenarios
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSetDefault(row.id)}
                    className="text-xs text-[color:var(--mwm-navy)] hover:underline mt-1"
                  >
                    Set as default
                  </button>
                )}
              </div>
              <div className="flex items-start gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(row)}
                  className="text-xs font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(row.id)}
                  className="text-xs font-medium text-red-700 border border-red-200 rounded-lg px-3 py-1.5 bg-white hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
