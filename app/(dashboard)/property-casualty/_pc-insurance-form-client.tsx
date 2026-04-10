'use client'

import { useState } from 'react'

interface PCPolicy {
  id: string
  insurance_type: string | null
  provider: string | null
  policy_name: string | null
  policy_number: string | null
  coverage_amount: number | null
  deductible: number | null
  monthly_premium: number | null
  annual_premium: number | null
  expiration_date: string | null
  notes: string | null
}

interface PCInsuranceType {
  value: string
  label: string
  description?: string | null
}

interface Props {
  policies: PCPolicy[]
  pcInsuranceTypes: PCInsuranceType[]
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

const EMPTY: Partial<PCPolicy> = {
  insurance_type: null,
  provider: null,
  policy_name: null,
  policy_number: null,
  coverage_amount: null,
  deductible: null,
  monthly_premium: null,
  annual_premium: null,
  expiration_date: null,
  notes: null,
}

export default function PCInsuranceFormClient({ policies, pcInsuranceTypes }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<PCPolicy | null>(null)
  const [form, setForm] = useState<Partial<PCPolicy>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY)
    setSaveError(null)
    setShowModal(true)
  }

  const openEdit = (policy: PCPolicy) => {
    setEditing(policy)
    setForm({ ...policy })
    setSaveError(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditing(null)
    setForm(EMPTY)
    setSaveError(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const url = editing ? `/api/insurance/${editing.id}` : '/api/insurance'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error) { setSaveError(data.error); return }
      closeModal()
      window.location.reload()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this policy?')) return
    setDeletingId(id)
    await fetch(`/api/insurance/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    window.location.reload()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Property & Casualty Insurance</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Auto, home, renters, umbrella, and other P&C coverage.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition"
        >
          + Add Policy
        </button>
      </div>

      {/* Empty state */}
      {policies.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-neutral-200 rounded-2xl">
          <p className="text-4xl mb-3">🏠</p>
          <p className="text-sm font-medium text-neutral-600">No P&C policies added yet</p>
          <p className="text-xs text-neutral-400 mt-1">Add auto, home, renters, umbrella, or other coverage</p>
          <button
            onClick={openAdd}
            className="mt-4 px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition"
          >
            Add your first policy
          </button>
        </div>
      )}

      {/* Policy list */}
      <div className="space-y-4">
        {policies.map((p) => {
          const typeLabel = pcInsuranceTypes.find(t => t.value === p.insurance_type)?.label ?? p.insurance_type ?? 'Policy'

          return (
            <div key={p.id} className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h3 className="font-semibold text-neutral-900">{p.policy_name || p.provider || 'Policy'}</h3>
                    <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{typeLabel}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-3">
                    {p.coverage_amount != null && p.coverage_amount > 0 && (
                      <div>
                        <p className="text-xs text-neutral-400">Coverage</p>
                        <p className="text-sm font-semibold text-neutral-800">{fmt(p.coverage_amount)}</p>
                      </div>
                    )}
                    {p.deductible != null && p.deductible > 0 && (
                      <div>
                        <p className="text-xs text-neutral-400">Deductible</p>
                        <p className="text-sm font-semibold text-neutral-800">{fmt(p.deductible)}</p>
                      </div>
                    )}
                    {p.annual_premium != null && p.annual_premium > 0 && (
                      <div>
                        <p className="text-xs text-neutral-400">Annual Premium</p>
                        <p className="text-sm font-semibold text-neutral-800">{fmt(p.annual_premium)}</p>
                      </div>
                    )}
                    {p.provider && (
                      <div>
                        <p className="text-xs text-neutral-400">Provider</p>
                        <p className="text-sm font-semibold text-neutral-800">{p.provider}</p>
                      </div>
                    )}
                  </div>
                </div>
                {/* Edit/Delete - top right */}
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(p)} className="text-xs text-indigo-600 hover:underline font-medium">Edit</button>
                  <button onClick={() => handleDelete(p.id)} disabled={deletingId === p.id}
                    className="text-xs text-red-500 hover:underline font-medium disabled:opacity-50">
                    {deletingId === p.id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">
                {editing ? 'Edit Policy' : 'Add P&C Policy'}
              </h2>
              <button onClick={closeModal} className="text-neutral-400 hover:text-neutral-600 text-xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Policy Type <span className="text-red-500">*</span></label>
                <select value={form.insurance_type ?? ''}
                  onChange={e => setForm(f => ({ ...f, insurance_type: e.target.value || null }))}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                  <option value="">Select type...</option>
                  {pcInsuranceTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Policy Name</label>
                  <input type="text" value={form.policy_name ?? ''} onChange={e => setForm(f => ({ ...f, policy_name: e.target.value || null }))}
                    placeholder="e.g. Home Policy" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Provider</label>
                  <input type="text" value={form.provider ?? ''} onChange={e => setForm(f => ({ ...f, provider: e.target.value || null }))}
                    placeholder="e.g. State Farm" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Policy Number</label>
                <input type="text" value={form.policy_number ?? ''} onChange={e => setForm(f => ({ ...f, policy_number: e.target.value || null }))}
                  placeholder="Optional" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Coverage Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-neutral-400 text-sm">$</span>
                    <input type="number" value={form.coverage_amount ?? ''} onChange={e => setForm(f => ({ ...f, coverage_amount: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="0" min="0" className="pl-7 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Deductible</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-neutral-400 text-sm">$</span>
                    <input type="number" value={form.deductible ?? ''} onChange={e => setForm(f => ({ ...f, deductible: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="0" min="0" className="pl-7 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Annual Premium</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-neutral-400 text-sm">$</span>
                    <input type="number" value={form.annual_premium ?? ''} onChange={e => setForm(f => ({ ...f, annual_premium: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="0" min="0" className="pl-7 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Monthly Premium</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-neutral-400 text-sm">$</span>
                    <input type="number" value={form.monthly_premium ?? ''} onChange={e => setForm(f => ({ ...f, monthly_premium: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="0" min="0" className="pl-7 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Renewal / Expiration Date</label>
                <input type="date" value={form.expiration_date ?? ''} onChange={e => setForm(f => ({ ...f, expiration_date: e.target.value || null }))}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
                <textarea value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
                  rows={2} placeholder="Any additional details..."
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            <div className="p-6 border-t border-neutral-100">
              {saveError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{saveError}</p>
              )}
              <div className="flex justify-end gap-3">
                <button onClick={closeModal} className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="px-5 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition">
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Policy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
