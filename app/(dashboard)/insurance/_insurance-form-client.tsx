'use client'

import { useRef, useState } from 'react'
import { RefSelect, CurrencyInput, ToggleField } from '@/components/ui/RefSelect'
import type { InsuranceTypeOption } from '@/lib/ref-data-fetchers'

interface InsurancePolicy {
  id: string
  insurance_type: string | null
  policy_subtype: string | null
  provider: string | null
  policy_name: string | null
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

interface InsuranceFormClientProps {
  policies: InsurancePolicy[]
  insuranceTypes: InsuranceTypeOption[]
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

export default function InsuranceFormClient({
  policies,
  insuranceTypes,
}: InsuranceFormClientProps) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<InsurancePolicy | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedType, setSelectedType] = useState<string>('')
  const formRef = useRef<HTMLFormElement>(null)

  const selectedTypeData = insuranceTypes.find(t => t.value === selectedType)
  const showDeathBenefit = selectedTypeData?.has_death_benefit ?? false
  const showCashValue = selectedTypeData?.has_cash_value ?? false
  const showIlit = selectedTypeData?.has_ilit_option ?? false
  const showTermYears = selectedType === 'term_life'

  const handleEdit = (policy: InsurancePolicy) => {
    setEditing(policy)
    setSelectedType(policy.insurance_type ?? '')
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const form = formRef.current!
    const data = new FormData(form)

    const payload: Record<string, unknown> = {
      insurance_type: data.get('insurance_type') as string || null,
      provider: data.get('provider') as string || null,
      policy_name: data.get('policy_name') as string || null,
      policy_number: data.get('policy_number') as string || null,
      coverage_amount: data.get('coverage_amount') ? Number(data.get('coverage_amount')) : null,
      death_benefit: data.get('death_benefit') ? Number(data.get('death_benefit')) : null,
      cash_value: data.get('cash_value') ? Number(data.get('cash_value')) : null,
      annual_premium: data.get('annual_premium') ? Number(data.get('annual_premium')) : null,
      monthly_premium: data.get('monthly_premium') ? Number(data.get('monthly_premium')) : null,
      term_years: data.get('term_years') ? Number(data.get('term_years')) : null,
      expiration_date: data.get('expiration_date') as string || null,
      is_employer_provided: data.get('is_employer_provided') === 'true',
      is_ilit: data.get('is_ilit') === 'true',
      notes: data.get('notes') as string || null,
    }

    const url = editing ? `/api/insurance/${editing.id}` : '/api/insurance'
    const method = editing ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      setShowForm(false)
      setEditing(null)
      setSelectedType('')
      window.location.reload()
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this policy?')) return
    await fetch(`/api/insurance/${id}`, { method: 'DELETE' })
    window.location.reload()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Insurance Policies</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Life insurance, annuities, long-term care, and disability coverage.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setSelectedType(''); setShowForm(true) }}
          className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition"
        >
          + Add Policy
        </button>
      </div>

      {policies.length === 0 && !showForm && (
        <div className="text-center py-16 border-2 border-dashed border-neutral-200 rounded-2xl">
          <p className="text-4xl mb-3">🛡️</p>
          <p className="text-sm font-medium text-neutral-600">No insurance policies added yet</p>
          <p className="text-xs text-neutral-400 mt-1">Add life insurance, annuities, LTC, or disability coverage</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition"
          >
            Add your first policy
          </button>
        </div>
      )}

      <div className="space-y-4 mb-6">
        {policies.map((p) => {
          const typeLabel = insuranceTypes.find(t => t.value === p.insurance_type)?.label ?? p.insurance_type ?? 'Insurance'
          const primaryValue = p.death_benefit ?? p.coverage_amount ?? 0

          return (
            <div key={p.id} className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h3 className="font-semibold text-neutral-900">{p.policy_name || p.provider || 'Insurance Policy'}</h3>
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
              </div>
              <div className="flex gap-3 mt-3 pt-3 border-t border-neutral-100">
                <button
                  onClick={() => handleEdit(p)}
                  className="text-xs text-indigo-600 hover:underline font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-xs text-red-500 hover:underline font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-6">
            {editing ? 'Edit Policy' : 'Add Insurance Policy'}
          </h2>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
            <RefSelect
              name="insurance_type"
              label="Insurance Type"
              options={insuranceTypes}
              defaultValue={editing?.insurance_type}
              required
              placeholder="Select insurance type..."
              helpText="Select the type of policy to show relevant fields."
              onChange={(e) => setSelectedType(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Policy Name / Description
                </label>
                <input
                  type="text"
                  name="policy_name"
                  defaultValue={editing?.policy_name ?? ''}
                  placeholder="e.g. 20-Year Term Policy"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Insurance Provider</label>
                <input
                  type="text"
                  name="provider"
                  defaultValue={editing?.provider ?? ''}
                  placeholder="e.g. Northwestern Mutual"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Policy Number</label>
                <input
                  type="text"
                  name="policy_number"
                  defaultValue={editing?.policy_number ?? ''}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {showTermYears && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Term Length (years)</label>
                  <input
                    type="number"
                    name="term_years"
                    defaultValue={editing?.term_years ?? ''}
                    placeholder="e.g. 20"
                    min="1"
                    max="40"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {showDeathBenefit && (
              <CurrencyInput
                name="death_benefit"
                label="Death Benefit / Face Value"
                defaultValue={editing?.death_benefit}
                helpText="Total amount paid to beneficiaries upon death."
              />
            )}

            {showCashValue && (
              <CurrencyInput
                name="cash_value"
                label="Current Cash Value"
                defaultValue={editing?.cash_value}
                helpText="Current accumulated cash value of the policy."
              />
            )}

            {!showDeathBenefit && (
              <CurrencyInput
                name="coverage_amount"
                label="Coverage Amount"
                defaultValue={editing?.coverage_amount}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <CurrencyInput
                name="annual_premium"
                label="Annual Premium"
                defaultValue={editing?.annual_premium}
              />
              <CurrencyInput
                name="monthly_premium"
                label="Monthly Premium"
                defaultValue={editing?.monthly_premium}
                helpText="Leave blank if entering annual premium."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Expiration / Maturity Date</label>
              <input
                type="date"
                name="expiration_date"
                defaultValue={editing?.expiration_date ?? ''}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="border-t border-neutral-100 pt-5 space-y-4">
              <ToggleField
                name="is_employer_provided"
                label="Employer-provided policy"
                defaultChecked={editing?.is_employer_provided ?? false}
                helpText="Group life or disability coverage through your employer."
              />
              {showIlit && (
                <ToggleField
                  name="is_ilit"
                  label="Held in an Irrevocable Life Insurance Trust (ILIT)"
                  defaultChecked={editing?.is_ilit ?? false}
                  helpText="If held in an ILIT, the death benefit is excluded from your taxable estate. Without an ILIT, the full death benefit may be included."
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
              <textarea
                name="notes"
                defaultValue={editing?.notes ?? ''}
                rows={2}
                placeholder="Any additional details..."
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition"
              >
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Policy'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditing(null); setSelectedType('') }}
                className="px-5 py-2 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
