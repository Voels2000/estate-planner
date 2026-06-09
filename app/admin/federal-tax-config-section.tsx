'use client'

import { useCallback, useEffect, useState } from 'react'

type FederalTaxConfigRow = {
  id: string
  scenario_id: string | null
  estate_exemption_individual: number
  estate_exemption_married: number
  estate_top_rate_pct: number
  annual_gift_exclusion: number
  is_active: boolean | null
}

type EditableField = keyof Pick<
  FederalTaxConfigRow,
  | 'estate_exemption_individual'
  | 'estate_exemption_married'
  | 'estate_top_rate_pct'
  | 'annual_gift_exclusion'
>

const FIELD_LABELS: Record<EditableField, string> = {
  estate_exemption_individual: 'Estate exemption (individual)',
  estate_exemption_married: 'Estate exemption (married)',
  estate_top_rate_pct: 'Top estate tax rate (%)',
  annual_gift_exclusion: 'Annual gift exclusion',
}

const CURRENCY_FIELDS = new Set<EditableField>([
  'estate_exemption_individual',
  'estate_exemption_married',
  'annual_gift_exclusion',
])

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function FederalTaxConfigSection() {
  const [expanded, setExpanded] = useState(true)
  const [rows, setRows] = useState<FederalTaxConfigRow[]>([])
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, Partial<Record<EditableField, number>>>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/tax-config')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load federal tax config')
      setRows(json.data.rows as FederalTaxConfigRow[])
      setLastUpdatedAt(json.data.lastUpdatedAt ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function startEdit() {
    const initial: Record<string, Partial<Record<EditableField, number>>> = {}
    for (const row of rows) {
      initial[row.id] = {
        estate_exemption_individual: row.estate_exemption_individual,
        estate_exemption_married: row.estate_exemption_married,
        estate_top_rate_pct: row.estate_top_rate_pct,
        annual_gift_exclusion: row.annual_gift_exclusion,
      }
    }
    setDraft(initial)
    setEditing(true)
    setError(null)
    setSuccess(null)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft({})
    setError(null)
  }

  function updateDraft(rowId: string, field: EditableField, value: number) {
    setDraft((prev) => ({
      ...prev,
      [rowId]: { ...prev[rowId], [field]: value },
    }))
  }

  async function handleSave() {
    setError(null)
    setSuccess(null)

    const pending: Array<{ id: string; changes: Partial<Record<EditableField, number>> }> = []
    for (const row of rows) {
      const rowDraft = draft[row.id]
      if (!rowDraft) continue
      const changes: Partial<Record<EditableField, number>> = {}
      for (const field of Object.keys(FIELD_LABELS) as EditableField[]) {
        if (rowDraft[field] !== undefined && rowDraft[field] !== row[field]) {
          changes[field] = rowDraft[field]
        }
      }
      if (Object.keys(changes).length > 0) {
        pending.push({ id: row.id, changes })
      }
    }

    if (pending.length === 0) {
      setEditing(false)
      return
    }

    const primary = pending[0]
    const exemptionChange = primary.changes.estate_exemption_individual
    if (exemptionChange !== undefined) {
      const oldRow = rows.find((r) => r.id === primary.id)
      const oldVal = oldRow?.estate_exemption_individual ?? 0
      const confirmed = window.confirm(
        `You are changing the federal estate tax exemption from ${formatCurrency(oldVal)} to ${formatCurrency(exemptionChange)}. This affects all household calculations. Confirm?`,
      )
      if (!confirmed) return
    } else {
      const confirmed = window.confirm(
        'You are changing federal tax configuration values. This affects all household calculations. Confirm?',
      )
      if (!confirmed) return
    }

    setSaving(true)
    try {
      for (const patch of pending) {
        const res = await fetch('/api/admin/tax-config', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Save failed')
      }
      setSuccess('Saved — audit log updated')
      setEditing(false)
      setDraft({})
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-neutral-50 transition"
      >
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Federal Tax Configuration</h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            These values feed directly into all estate tax calculations. Changes take effect immediately.
          </p>
        </div>
        <span className="text-neutral-400 text-sm shrink-0 ml-4">{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="px-6 pb-6 border-t border-neutral-100">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mt-4">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mt-4">
              {success}
            </p>
          )}

          <div className="flex items-center justify-between mt-4 mb-4">
            <p className="text-xs text-neutral-500">
              Last updated: {formatTimestamp(lastUpdatedAt)}
            </p>
            {!editing ? (
              <button
                type="button"
                onClick={startEdit}
                disabled={loading || rows.length === 0}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-neutral-500 disabled:opacity-50"
              >
                Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:border-neutral-500 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-neutral-400 py-6 text-center animate-pulse">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-neutral-500 py-6 text-center">
              No active federal_tax_config row found.
            </p>
          ) : (
            <div className="space-y-6">
              {rows.map((row) => (
                <div key={row.id} className="rounded-xl border border-neutral-200 p-4">
                  {row.scenario_id && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">
                      Scenario: {row.scenario_id}
                    </p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(Object.keys(FIELD_LABELS) as EditableField[]).map((field) => {
                      const value = editing
                        ? (draft[row.id]?.[field] ?? row[field])
                        : row[field]
                      return (
                        <div key={field}>
                          <label className="block text-xs font-medium text-neutral-500 mb-1">
                            {FIELD_LABELS[field]}
                          </label>
                          {editing ? (
                            <input
                              type="number"
                              value={value}
                              min={1}
                              step={field === 'estate_top_rate_pct' ? 0.1 : 1}
                              onChange={(e) =>
                                updateDraft(row.id, field, Number(e.target.value))
                              }
                              className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                            />
                          ) : (
                            <p className="text-sm font-medium text-neutral-900">
                              {CURRENCY_FIELDS.has(field)
                                ? formatCurrency(value)
                                : `${value}%`}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {success && (
            <p className="text-xs text-neutral-500 mt-4 border-t border-neutral-100 pt-4">
              Note: existing projection snapshots will regenerate on next household visit
              (staleness trigger fires automatically via households.updated_at).
            </p>
          )}
        </div>
      )}
    </div>
  )
}
