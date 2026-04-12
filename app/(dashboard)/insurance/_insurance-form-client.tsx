'use client'

// ─────────────────────────────────────────
// Menu: Financial Planning > Life & Estate Insurance
// Route: /insurance
// ─────────────────────────────────────────

import { useState } from 'react'
import { insurancePolicyRowForSave } from '@/lib/insurance-policy-save-payload'
import type { InsuranceTypeOption } from '@/lib/ref-data-fetchers'

interface InsurancePolicy {
  id: string
  insurance_type: string | null
  provider: string | null
  policy_name: string | null
  owner: string | null
  policy_number: string | null
  coverage_amount: number | null
  death_benefit: number | null
  cash_value: number | null
  monthly_premium: number | null
  annual_premium: number | null
  term_years: number | null
  expiration_date: string | null
  is_employer_provided: boolean
  is_ilit: boolean
  notes: string | null
}

interface Props {
  policies: InsurancePolicy[]
  insuranceTypes: InsuranceTypeOption[]
  person1Name: string
  person2Name: string | null
  hasSpouse: boolean
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

const EMPTY: Partial<InsurancePolicy> = {
  insurance_type: null,
  provider: null,
  policy_name: null,
  owner: null,
  policy_number: null,
  coverage_amount: null,
  death_benefit: null,
  cash_value: null,
  monthly_premium: null,
  annual_premium: null,
  term_years: null,
  expiration_date: null,
  is_employer_provided: false,
  is_ilit: false,
  notes: null,
}

function displayPolicyOwner(
  owner: string | null | undefined,
  person1Name: string,
  person2Name: string | null,
): string | null {
  if (!owner) return null
  if (owner === 'person1') return person1Name
  if (owner === 'person2') return person2Name ?? 'Person 2'
  if (owner === 'trust') return 'Trust'
  if (owner === 'other') return 'Other'
  return owner
}

export default function InsuranceFormClient({
  policies,
  insuranceTypes,
  person1Name,
  person2Name,
  hasSpouse,
}: Props) {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<InsurancePolicy | null>(null)
  const [form, setForm] = useState<Partial<InsurancePolicy>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const selectedTypeData = insuranceTypes.find(t => t.value === form.insurance_type)
  const showDeathBenefit = selectedTypeData?.has_death_benefit ?? false
  const showCashValue = selectedTypeData?.has_cash_value ?? false
  const showIlit = selectedTypeData?.has_ilit_option ?? false
  const showTermYears = form.insurance_type === 'term_life'
  const showPerson2Option = Boolean(hasSpouse && person2Name?.trim())

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY)
    setSaveError(null)
    setShowModal(true)
  }

  const openEdit = (policy: InsurancePolicy) => {
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
      const payload = insurancePolicyRowForSave({ ...form } as Record<string, unknown>)
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
          <h1 className="text-2xl font-bold text-neutral-900">Life & Estate Insurance</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Life insurance, annuities, long-term care, and disability coverage.
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
          <p className="text-4xl mb-3">🛡️</p>
          <p className="text-sm font-medium text-neutral-600">No policies added yet</p>
          <p className="text-xs text-neutral-400 mt-1">Add life insurance, annuities, LTC, or disability coverage</p>
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
          const typeLabel = insuranceTypes.find(t => t.value === p.insurance_type)?.label ?? p.insurance_type ?? 'Insurance'
          const primaryValue = p.death_benefit ?? p.coverage_amount ?? 0
          const ownerLabel = displayPolicyOwner(p.owner, person1Name, person2Name)

          return (
            <div key={p.id} className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h3 className="font-semibold text-neutral-900">
                      {p.policy_name || p.provider || 'Insurance Policy'}
                      {ownerLabel && (
                        <span className="text-neutral-500 font-normal"> · {ownerLabel}</span>
                      )}
                    </h3>
                    <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{typeLabel}</span>
                    {p.is_ilit && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">✓ ILIT</span>
                    )}
                    {!p.is_ilit && (p.insurance_type?.includes('life') || p.insurance_type === 'survivorship_life') && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⚠ Not in ILIT</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-3">
                    {primaryValue > 0 && (
                      <div>
                        <p className="text-xs text-neutral-400">{p.death_benefit ? 'Death Benefit' : 'Coverage'}</p>
                        <p className="text-sm font-semibold text-neutral-800">{fmt(primaryValue)}</p>
                      </div>
                    )}
                    {p.cash_value != null && p.cash_value > 0 && (
                      <div>
                        <p className="text-xs text-neutral-400">Cash Value</p>
                        <p className="text-sm font-semibold text-neutral-800">{fmt(p.cash_value)}</p>
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
                  <button
                    onClick={() => openEdit(p)}
                    className="text-xs text-indigo-600 hover:underline font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    className="text-xs text-red-500 hover:underline font-medium disabled:opacity-50"
                  >
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
                {editing ? 'Edit Policy' : 'Add Insurance Policy'}
              </h2>
              <button onClick={closeModal} className="text-neutral-400 hover:text-neutral-600 text-xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Insurance type */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Insurance Type <span className="text-red-500">*</span></label>
                <select
                  value={form.insurance_type ?? ''}
                  onChange={e => setForm(f => ({ ...f, insurance_type: e.target.value || null }))}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">Select type...</option>
                  {insuranceTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 items-start">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Policy Name</label>
                    <input type="text" value={form.policy_name ?? ''} onChange={e => setForm(f => ({ ...f, policy_name: e.target.value || null }))}
                      placeholder="e.g. 20-Year Term" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Policy Owner</label>
                    <select
                      value={form.owner ?? ''}
                      onChange={e => setForm(f => ({ ...f, owner: e.target.value || null }))}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="">Select owner...</option>
                      <option value="person1">{person1Name}</option>
                      {showPerson2Option && (
                        <option value="person2">{person2Name}</option>
                      )}
                      {form.owner === 'person2' && !showPerson2Option && (
                        <option value="person2">{person2Name ?? 'Person 2'}</option>
                      )}
                      <option value="trust">Trust</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Provider</label>
                  <input type="text" value={form.provider ?? ''} onChange={e => setForm(f => ({ ...f, provider: e.target.value || null }))}
                    placeholder="e.g. Northwestern Mutual" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Policy Number</label>
                <input type="text" value={form.policy_number ?? ''} onChange={e => setForm(f => ({ ...f, policy_number: e.target.value || null }))}
                  placeholder="Optional" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              {showTermYears && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Term Length (years)</label>
                  <input type="number" value={form.term_years ?? ''} onChange={e => setForm(f => ({ ...f, term_years: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="e.g. 20" min="1" max="40" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              )}

              {showDeathBenefit && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Death Benefit / Face Value</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-neutral-400 text-sm">$</span>
                    <input type="number" value={form.death_benefit ?? ''} onChange={e => setForm(f => ({ ...f, death_benefit: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="0" min="0" className="pl-7 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">Total amount paid to beneficiaries upon death.</p>
                </div>
              )}

              {showCashValue && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Current Cash Value</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-neutral-400 text-sm">$</span>
                    <input type="number" value={form.cash_value ?? ''} onChange={e => setForm(f => ({ ...f, cash_value: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="0" min="0" className="pl-7 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              )}

              {!showDeathBenefit && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Coverage Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-neutral-400 text-sm">$</span>
                    <input type="number" value={form.coverage_amount ?? ''} onChange={e => setForm(f => ({ ...f, coverage_amount: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="0" min="0" className="pl-7 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              )}

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
                <label className="block text-sm font-medium text-neutral-700 mb-1">Expiration / Maturity Date</label>
                <input type="date" value={form.expiration_date ?? ''} onChange={e => setForm(f => ({ ...f, expiration_date: e.target.value || null }))}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div className="border-t border-neutral-100 pt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="is_employer_provided" checked={form.is_employer_provided ?? false}
                    onChange={e => setForm(f => ({ ...f, is_employer_provided: e.target.checked }))}
                    className="h-4 w-4 rounded border-neutral-300 text-indigo-600" />
                  <label htmlFor="is_employer_provided" className="text-sm text-neutral-700 cursor-pointer">Employer-provided policy</label>
                </div>
                {showIlit && (
                  <div className="flex items-start gap-3">
                    <input type="checkbox" id="is_ilit" checked={form.is_ilit ?? false}
                      onChange={e => setForm(f => ({ ...f, is_ilit: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-indigo-600" />
                    <div>
                      <label htmlFor="is_ilit" className="text-sm font-medium text-neutral-700 cursor-pointer">Held in an ILIT</label>
                      <p className="text-xs text-neutral-400 mt-0.5">If held in an Irrevocable Life Insurance Trust, the death benefit is excluded from your taxable estate.</p>
                    </div>
                  </div>
                )}
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
