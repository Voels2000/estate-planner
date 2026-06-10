'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import type { StateEstateTaxData } from '@/lib/learn/state-estate-tax-types'
import { getStaleness } from '@/lib/learn/state-estate-tax-types'
import { stateCodeToSlug } from '@/lib/learn/state-estate-tax-slugs'
import type { StateTaxContentAuditEntry } from '@/lib/admin/stateTaxContentAudit'

const dollarFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

type Draft = {
  exemption_amount: number
  exemption_indexed: boolean
  top_rate_pct: number
  portability: boolean
  has_cliff_effect: boolean
  law_effective_date: string
  last_reviewed: string
  review_notes: string
  scenario_estate_value: string
  scenario_tax_no_plan: string
  scenario_tax_with_plan: string
  scenario_notes: string
  bracketsJson: string
  quirksJson: string
}

function rowToDraft(row: StateEstateTaxData): Draft {
  return {
    exemption_amount: row.exemption_amount,
    exemption_indexed: row.exemption_indexed,
    top_rate_pct: row.top_rate_pct,
    portability: row.portability,
    has_cliff_effect: row.has_cliff_effect,
    law_effective_date: row.law_effective_date,
    last_reviewed: row.last_reviewed,
    review_notes: row.review_notes ?? '',
    scenario_estate_value: row.scenario_estate_value?.toString() ?? '',
    scenario_tax_no_plan: row.scenario_tax_no_plan?.toString() ?? '',
    scenario_tax_with_plan: row.scenario_tax_with_plan?.toString() ?? '',
    scenario_notes: row.scenario_notes ?? '',
    bracketsJson: JSON.stringify(row.brackets, null, 2),
    quirksJson: JSON.stringify(row.quirks, null, 2),
  }
}

function parseOptionalNumber(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const STALENESS_STYLES = {
  current: { bg: '#eef6f4', color: '#2d6a4f', label: 'Current' },
  review_due: { bg: '#fdf6e3', color: '#8a4e00', label: 'Review due' },
  overdue: { bg: '#fef3ee', color: '#c53030', label: 'Overdue' },
} as const

export default function StateTaxContentTab() {
  const [rows, setRows] = useState<StateEstateTaxData[]>([])
  const [auditLog, setAuditLog] = useState<StateTaxContentAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/state-tax-content')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load')
      setRows(json.data as StateEstateTaxData[])
      setAuditLog(json.auditLog as StateTaxContentAuditEntry[])
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

  const summary = useMemo(() => {
    const counts = { current: 0, review_due: 0, overdue: 0 }
    for (const r of rows) {
      counts[getStaleness(r.last_reviewed)]++
    }
    return counts
  }, [rows])

  function openEdit(row: StateEstateTaxData) {
    setEditingCode(row.state_code)
    setDraft(rowToDraft(row))
    setJsonError(null)
    setSaveMessage(null)
  }

  function closeEdit() {
    setEditingCode(null)
    setDraft(null)
    setJsonError(null)
  }

  function validateJsonFields(d: Draft): { brackets: unknown; quirks: unknown } | null {
    try {
      const brackets = JSON.parse(d.bracketsJson)
      const quirks = JSON.parse(d.quirksJson)
      setDraft({
        ...d,
        bracketsJson: JSON.stringify(brackets, null, 2),
        quirksJson: JSON.stringify(quirks, null, 2),
      })
      setJsonError(null)
      return { brackets, quirks }
    } catch {
      setJsonError('Invalid JSON — fix brackets or quirks before saving.')
      return null
    }
  }

  async function handleSave(row: StateEstateTaxData) {
    if (!draft) return
    const parsed = validateJsonFields(draft)
    if (!parsed) return

    setSaving(true)
    setSaveMessage(null)
    setError(null)

    const today = new Date().toISOString().slice(0, 10)
    const changes: Record<string, unknown> = {
      exemption_amount: draft.exemption_amount,
      exemption_indexed: draft.exemption_indexed,
      top_rate_pct: draft.top_rate_pct,
      portability: draft.portability,
      has_cliff_effect: draft.has_cliff_effect,
      law_effective_date: draft.law_effective_date,
      last_reviewed: today,
      review_notes: draft.review_notes || null,
      brackets: parsed.brackets,
      quirks: parsed.quirks,
      scenario_estate_value: parseOptionalNumber(draft.scenario_estate_value),
      scenario_tax_no_plan: parseOptionalNumber(draft.scenario_tax_no_plan),
      scenario_tax_with_plan: parseOptionalNumber(draft.scenario_tax_with_plan),
      scenario_notes: draft.scenario_notes || null,
    }

    try {
      const res = await fetch('/api/admin/state-tax-content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state_code: row.state_code, changes }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      setSaveMessage(`Saved — ${row.state_name} updated. Live pages reflect changes on next build or revalidation.`)
      closeEdit()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading state tax content…</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-neutral-900">State Estate Tax Content</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Public /learn pages — separate from Engine B calculation data in stateEstateTax.ts
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
          {rows.length} states
        </span>
        <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: STALENESS_STYLES.current.bg, color: STALENESS_STYLES.current.color }}>
          {summary.current} current
        </span>
        <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: STALENESS_STYLES.review_due.bg, color: STALENESS_STYLES.review_due.color }}>
          {summary.review_due} review due
        </span>
        <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: STALENESS_STYLES.overdue.bg, color: STALENESS_STYLES.overdue.color }}>
          {summary.overdue} overdue
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Exemption</th>
              <th className="px-4 py-3">Top rate</th>
              <th className="px-4 py-3">Portability</th>
              <th className="px-4 py-3">Cliff</th>
              <th className="px-4 py-3">Last reviewed</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((row) => {
              const staleness = getStaleness(row.last_reviewed)
              const style = STALENESS_STYLES[staleness]
              const slug = stateCodeToSlug(row.state_code)
              const isEditing = editingCode === row.state_code

              return (
                <Fragment key={row.state_code}>
                  <tr className="bg-white">
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {row.state_name}
                      <span className="ml-1 text-neutral-400">({row.state_code})</span>
                    </td>
                    <td className="px-4 py-3">{dollarFmt.format(row.exemption_amount)}</td>
                    <td className="px-4 py-3">{row.top_rate_pct}%</td>
                    <td className="px-4 py-3">{row.portability ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3">{row.has_cliff_effect ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3">{row.last_reviewed}</td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{ background: style.bg, color: style.color }}
                      >
                        {style.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => (isEditing ? closeEdit() : openEdit(row))}
                        className="text-xs font-semibold text-neutral-700 hover:text-neutral-900 underline"
                      >
                        {isEditing ? 'Cancel' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                  {isEditing && draft && (
                    <tr>
                      <td colSpan={8} className="bg-neutral-50 px-4 py-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="block text-xs text-neutral-600">
                            Exemption amount
                            <input
                              type="number"
                              className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                              value={draft.exemption_amount}
                              onChange={(e) =>
                                setDraft({ ...draft, exemption_amount: Number(e.target.value) })
                              }
                            />
                          </label>
                          <label className="block text-xs text-neutral-600">
                            Top rate %
                            <input
                              type="number"
                              step="0.1"
                              className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                              value={draft.top_rate_pct}
                              onChange={(e) =>
                                setDraft({ ...draft, top_rate_pct: Number(e.target.value) })
                              }
                            />
                          </label>
                          <label className="flex items-center gap-2 text-xs text-neutral-600">
                            <input
                              type="checkbox"
                              checked={draft.exemption_indexed}
                              onChange={(e) =>
                                setDraft({ ...draft, exemption_indexed: e.target.checked })
                              }
                            />
                            Exemption indexed
                          </label>
                          <label className="flex items-center gap-2 text-xs text-neutral-600">
                            <input
                              type="checkbox"
                              checked={draft.portability}
                              onChange={(e) =>
                                setDraft({ ...draft, portability: e.target.checked })
                              }
                            />
                            Portability
                          </label>
                          <label className="flex items-center gap-2 text-xs text-neutral-600">
                            <input
                              type="checkbox"
                              checked={draft.has_cliff_effect}
                              onChange={(e) =>
                                setDraft({ ...draft, has_cliff_effect: e.target.checked })
                              }
                            />
                            Has cliff effect
                          </label>
                          <label className="block text-xs text-neutral-600">
                            Law effective date
                            <input
                              type="date"
                              className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                              value={draft.law_effective_date}
                              onChange={(e) =>
                                setDraft({ ...draft, law_effective_date: e.target.value })
                              }
                            />
                          </label>
                          <label className="block text-xs text-neutral-600 md:col-span-2">
                            Review notes
                            <textarea
                              className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                              rows={2}
                              value={draft.review_notes}
                              onChange={(e) =>
                                setDraft({ ...draft, review_notes: e.target.value })
                              }
                            />
                          </label>
                          <label className="block text-xs text-neutral-600">
                            Scenario estate value
                            <input
                              type="number"
                              className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                              value={draft.scenario_estate_value}
                              onChange={(e) =>
                                setDraft({ ...draft, scenario_estate_value: e.target.value })
                              }
                            />
                          </label>
                          <label className="block text-xs text-neutral-600">
                            Scenario tax (no plan)
                            <input
                              type="number"
                              className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                              value={draft.scenario_tax_no_plan}
                              onChange={(e) =>
                                setDraft({ ...draft, scenario_tax_no_plan: e.target.value })
                              }
                            />
                          </label>
                          <label className="block text-xs text-neutral-600">
                            Scenario tax (with plan)
                            <input
                              type="number"
                              className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                              value={draft.scenario_tax_with_plan}
                              onChange={(e) =>
                                setDraft({ ...draft, scenario_tax_with_plan: e.target.value })
                              }
                            />
                          </label>
                          <label className="block text-xs text-neutral-600 md:col-span-2">
                            Scenario notes
                            <textarea
                              className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                              rows={2}
                              value={draft.scenario_notes}
                              onChange={(e) =>
                                setDraft({ ...draft, scenario_notes: e.target.value })
                              }
                            />
                          </label>
                          <div className="md:col-span-2">
                            <label className="block text-xs text-neutral-600">
                              Brackets (JSON)
                              <textarea
                                className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 font-mono text-xs"
                                rows={8}
                                value={draft.bracketsJson}
                                onChange={(e) =>
                                  setDraft({ ...draft, bracketsJson: e.target.value })
                                }
                              />
                            </label>
                            <p className="mt-1 text-xs text-neutral-500">
                              After editing brackets or quirks, verify the live page at{' '}
                              {slug ? `/learn/${slug}` : '/learn/…'} renders correctly.
                            </p>
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs text-neutral-600">
                              Quirks (JSON)
                              <textarea
                                className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 font-mono text-xs"
                                rows={6}
                                value={draft.quirksJson}
                                onChange={(e) =>
                                  setDraft({ ...draft, quirksJson: e.target.value })
                                }
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => draft && validateJsonFields(draft)}
                              className="mt-2 rounded border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                            >
                              Validate JSON
                            </button>
                            {jsonError && (
                              <p className="mt-1 text-xs text-red-600">{jsonError}</p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleSave(row)}
                          className="mt-4 rounded bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
                        >
                          {saving ? 'Saving…' : 'Save & mark reviewed'}
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {saveMessage && (
        <p className="text-sm text-green-700">{saveMessage}</p>
      )}

      <section>
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">Recent audit log</h3>
        {auditLog.length === 0 ? (
          <p className="text-sm text-neutral-500">No updates yet.</p>
        ) : (
          <ul className="space-y-2 text-xs text-neutral-600">
            {auditLog.map((entry, i) => (
              <li key={i} className="rounded border border-neutral-200 bg-white px-3 py-2">
                <span className="font-medium text-neutral-800">{entry.state_code}</span>
                {' · '}
                {entry.changedFields?.join(', ') ?? '—'}
                {' · '}
                {entry.adminEmail}
                {' · '}
                {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
