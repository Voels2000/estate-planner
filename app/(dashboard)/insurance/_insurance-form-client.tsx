'use client'

import { useRef, useState } from 'react'
import { RefSelect, CurrencyInput, ToggleField } from '@/components/ui/RefSelect'
import type { RefOption } from '@/lib/ref-data-fetchers'

interface InsuranceTypeOption extends RefOption {
  has_death_benefit: boolean
  has_cash_value: boolean
  has_ilit_option: boolean
}

interface InsurancePolicy {
  id: string
  insurance_type: string | null
  policy_name: string | null
  provider: string | null
  policy_number: string | null
  death_benefit: number | null
  cash_value: number | null
  coverage_amount: number | null
  annual_premium: number | null
  monthly_premium: number | null
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
  const [selectedType, setSelectedType] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const selectedTypeData = insuranceTypes.find((t) => t.value === selectedType)
  const showDeathBenefit = selectedTypeData?.has_death_benefit ?? false
  const showCashValue = selectedTypeData?.has_cash_value ?? false
  const showIlit = selectedTypeData?.has_ilit_option ?? false
  const showTermYears = selectedType === 'term_life'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const form = formRef.current!
    const data = new FormData(form)

    const payload: Record<string, unknown> = {
      insurance_type: (data.get('insurance_type') as string) || null,
      policy_name: (data.get('policy_name') as string) || null,
      provider: (data.get('provider') as string) || null,
      policy_number: (data.get('policy_number') as string) || null,
      death_benefit: data.get('death_benefit') ? Number(data.get('death_benefit')) : null,
      cash_value: data.get('cash_value') ? Number(data.get('cash_value')) : null,
      coverage_amount: data.get('coverage_amount') ? Number(data.get('coverage_amount')) : null,
      annual_premium: data.get('annual_premium') ? Number(data.get('annual_premium')) : null,
      monthly_premium: data.get('monthly_premium') ? Number(data.get('monthly_premium')) : null,
      term_years: data.get('term_years') ? Number(data.get('term_years')) : null,
      expiration_date: (data.get('expiration_date') as string) || null,
      is_employer_provided: data.get('is_employer_provided') === 'true',
      is_ilit: data.get('is_ilit') === 'true',
      notes: (data.get('notes') as string) || null,
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
          onClick={() => {
            setEditing(null)
            setSelectedType('')
            setShowForm(true)
          }}
          className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition"
        >
          + Add Policy
        </button>
      </div>

      {policies.length === 0 && !showForm && (
        <div className="text-center py-16 border-2 border-dashed border-neutral-200 rounded-2xl">
          <p className="text-4xl mb-3">🛡️</p>
          <p className="text-sm font-medium text-neutral-600">No insurance policies added yet</p>
          <p className="text-xs text-neutral-400 mt-1">
            Add life insurance, annuities, LTC, or disability coverage
          </p>
          <button
            onClick={() => {
              setEditing(null)
              setSelectedType('')
              setShowForm(true)
            }}
            className="mt-4 px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition"
          >
            Add your first policy
          </button>
        </div>
      )}

      <div className="space-y-4 mb-6">
        {policies.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-neutral-900">
                    {p.policy_name || p.provider || 'Insurance Policy'}
                  </h3>
                  {p.insurance_type && (
                    <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
                      {insuranceTypes.find((t) => t.value === p.insurance_type)?.label ?? p.insurance_type}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div>
                    <p className="text-xs text-neutral-400">Coverage</p>
                    <p className="text-sm font-semibold text-neutral-800">
                      {p.death_benefit
                        ? fmt(p.death_benefit)
                        : p.coverage_amount
                          ? fmt(p.coverage_amount)
                          : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400">Cash Value</p>
                    <p className="text-sm font-semibold text-neutral-800">
                      {p.cash_value ? fmt(p.cash_value) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400">Annual Premium</p>
                    <p className="text-sm font-semibold text-neutral-800">
                      {p.annual_premium ? fmt(p.annual_premium) : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 mt-3">
                  {p.is_employer_provided ? (
                    <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      ✓ Employer provided
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full">
                      Individual policy
                    </span>
                  )}
                  {p.is_ilit && (
                    <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      ✓ ILIT
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    setEditing(p)
                    setSelectedType(p.insurance_type ?? '')
                    setShowForm(true)
                  }}
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
          </div>
        ))}
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
              onChange={(e) => setSelectedType(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Policy Name</label>
                <input
                  type="text"
                  name="policy_name"
                  defaultValue={editing?.policy_name ?? ''}
                  placeholder="e.g. 20-Year Term Policy"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Provider</label>
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
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Term Years</label>
                  <input
                    type="number"
                    name="term_years"
                    defaultValue={editing?.term_years ?? ''}
                    min="1"
                    max="40"
                    placeholder="e.g. 20"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {showDeathBenefit && (
              <CurrencyInput
                name="death_benefit"
                label="Death Benefit"
                defaultValue={editing?.death_benefit}
              />
            )}

            {showCashValue && (
              <CurrencyInput
                name="cash_value"
                label="Cash Value"
                defaultValue={editing?.cash_value}
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
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Expiration Date</label>
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
                label="Employer-provided"
                defaultChecked={editing?.is_employer_provided ?? false}
              />
              {showIlit && (
                <ToggleField
                  name="is_ilit"
                  label="Held in ILIT"
                  defaultChecked={editing?.is_ilit ?? false}
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
              <textarea
                name="notes"
                defaultValue={editing?.notes ?? ''}
                rows={3}
                placeholder="Any additional policy context..."
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
                onClick={() => {
                  setShowForm(false)
                  setEditing(null)
                  setSelectedType('')
                }}
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
