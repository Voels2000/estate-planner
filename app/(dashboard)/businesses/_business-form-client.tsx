'use client'

// ─────────────────────────────────────────
// Menu: Financial Planning > Business Interests
// Route: /businesses
// ─────────────────────────────────────────

import { useRef, useState } from 'react'
import { RefSelect, CurrencyInput, PctInput, ToggleField } from '@/components/ui/RefSelect'
import type { RefOption } from '@/lib/ref-data-fetchers'

interface Business {
  id: string
  name: string
  entity_type: string | null
  ownership_pct: number | null
  estimated_value: number | null
  owner_estimated_value: number | null
  valuation_method: string | null
  ebitda: number | null
  valuation_multiple: number | null
  valuation_discount_pct: number | null
  has_buy_sell_agreement: boolean
  buy_sell_funded: boolean
  has_key_person_insurance: boolean
  succession_plan: string | null
  industry: string | null
  state_of_formation: string | null
  notes: string | null
  estate_inclusion_status?: string | null
}

interface BusinessFormClientProps {
  businesses: Business[]
  entityTypes: RefOption[]
  valuationMethods: RefOption[]
  successionPlans: RefOption[]
  householdId: string
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

export default function BusinessFormClient({
  businesses,
  entityTypes,
  valuationMethods,
  successionPlans,
  householdId,
}: BusinessFormClientProps) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Business | null>(null)
  const [saving, setSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  void householdId

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const form = formRef.current!
    const data = new FormData(form)

    const payload: Record<string, unknown> = {
      name: (data.get('name') as string) ?? '',
      entity_type: (data.get('entity_type') as string) || null,
      ownership_pct: data.get('ownership_pct') ? Number(data.get('ownership_pct')) : null,
      estimated_value: data.get('estimated_value') ? Number(data.get('estimated_value')) : null,
      valuation_method: (data.get('valuation_method') as string) || null,
      ebitda: data.get('ebitda') ? Number(data.get('ebitda')) : null,
      valuation_multiple: data.get('valuation_multiple') ? Number(data.get('valuation_multiple')) : null,
      valuation_discount_pct: data.get('valuation_discount_pct') ? Number(data.get('valuation_discount_pct')) : null,
      has_buy_sell_agreement: data.get('has_buy_sell_agreement') === 'true',
      buy_sell_funded: data.get('buy_sell_funded') === 'true',
      has_key_person_insurance: data.get('has_key_person_insurance') === 'true',
      succession_plan: (data.get('succession_plan') as string) || null,
      industry: (data.get('industry') as string) || null,
      state_of_formation: (data.get('state_of_formation') as string) || null,
      notes: (data.get('notes') as string) || null,
      estate_inclusion_status: (data.get('estate_inclusion_status') as string) || 'included',
    }

    if (payload.estimated_value && payload.ownership_pct) {
      payload.owner_estimated_value = Math.round(
        Number(payload.estimated_value) * Number(payload.ownership_pct) / 100,
      )
    }

    const url = editing ? `/api/businesses/${editing.id}` : '/api/businesses'
    const method = editing ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      setShowForm(false)
      setEditing(null)
      window.location.reload()
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this business?')) return
    await fetch(`/api/businesses/${id}`, { method: 'DELETE' })
    window.location.reload()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Business Interests</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Closely-held businesses, partnerships, and private equity interests.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
          className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition"
        >
          + Add Business
        </button>
      </div>

      {businesses.length === 0 && !showForm && (
        <div className="text-center py-16 border-2 border-dashed border-neutral-200 rounded-2xl">
          <p className="text-4xl mb-3">🏢</p>
          <p className="text-sm font-medium text-neutral-600">No business interests added yet</p>
          <p className="text-xs text-neutral-400 mt-1">Add closely-held businesses, partnerships, or private equity</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition"
          >
            Add your first business
          </button>
        </div>
      )}

      <div className="space-y-4 mb-6">
        {businesses.map((b) => (
          <div key={b.id} className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-neutral-900">{b.name}</h3>
                  {b.entity_type && (
                    <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
                      {entityTypes.find(e => e.value === b.entity_type)?.label ?? b.entity_type}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div>
                    <p className="text-xs text-neutral-400">Estimated Value</p>
                    <p className="text-sm font-semibold text-neutral-800">{b.estimated_value ? fmt(b.estimated_value) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400">Your Ownership</p>
                    <p className="text-sm font-semibold text-neutral-800">{b.ownership_pct ? `${b.ownership_pct}%` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400">Your Share</p>
                    <p className="text-sm font-semibold text-neutral-800">{b.owner_estimated_value ? fmt(b.owner_estimated_value) : '—'}</p>
                  </div>
                </div>
                <div className="flex gap-4 mt-3 flex-wrap">
                  {b.has_buy_sell_agreement ? (
                    <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">✓ Buy-sell agreement</span>
                  ) : (
                    <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">⚠ No buy-sell agreement</span>
                  )}
                  {b.has_key_person_insurance && (
                    <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">✓ Key person insurance</span>
                  )}
                  {b.estate_inclusion_status && b.estate_inclusion_status !== 'included' ? (
                    <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">✓ Outside taxable estate</span>
                  ) : (
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Inside taxable estate</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    setEditing(b)
                    setShowForm(true)
                  }}
                  className="text-xs text-indigo-600 hover:underline font-medium"
                >
                  Edit
                </button>
                <button onClick={() => handleDelete(b.id)} className="text-xs text-red-500 hover:underline font-medium">
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-6">{editing ? 'Edit Business' : 'Add Business Interest'}</h2>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Business Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                defaultValue={editing?.name ?? ''}
                placeholder="e.g. Acme Holdings LLC"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <RefSelect
                name="entity_type"
                label="Entity Type"
                options={entityTypes}
                defaultValue={editing?.entity_type}
                placeholder="Select entity type..."
              />
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Industry</label>
                <input
                  type="text"
                  name="industry"
                  defaultValue={editing?.industry ?? ''}
                  placeholder="e.g. Technology, Real Estate, Healthcare"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">State of Formation</label>
                <input
                  type="text"
                  name="state_of_formation"
                  defaultValue={editing?.state_of_formation ?? ''}
                  placeholder="e.g. WA, DE, NY"
                  maxLength={2}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <PctInput
                name="ownership_pct"
                label="Your Ownership %"
                defaultValue={editing?.ownership_pct}
                helpText="Your percentage ownership of the business"
              />
            </div>

            <div className="border-t border-neutral-100 pt-5">
              <h3 className="text-sm font-semibold text-neutral-700 mb-4">Valuation</h3>
              <div className="grid grid-cols-2 gap-4">
                <RefSelect
                  name="valuation_method"
                  label="Valuation Method"
                  options={valuationMethods}
                  defaultValue={editing?.valuation_method}
                  placeholder="Select method..."
                  helpText="How is the business value estimated?"
                />
                <CurrencyInput
                  name="estimated_value"
                  label="Total Business Value"
                  defaultValue={editing?.estimated_value}
                  helpText="Full value of the business (100% ownership)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <CurrencyInput
                  name="ebitda"
                  label="Annual EBITDA"
                  defaultValue={editing?.ebitda}
                  helpText="If using EBITDA multiple method"
                />
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">EBITDA Multiple</label>
                  <input
                    type="number"
                    name="valuation_multiple"
                    defaultValue={editing?.valuation_multiple ?? ''}
                    min="0"
                    step="0.1"
                    placeholder="e.g. 5.0"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="mt-4">
                <PctInput
                  name="valuation_discount_pct"
                  label="Valuation Discount %"
                  defaultValue={editing?.valuation_discount_pct}
                  helpText="Minority interest or lack of marketability discount. Can reduce estate value 20-40%."
                />
              </div>
            </div>

            <div className="border-t border-neutral-100 pt-5">
              <h3 className="text-sm font-semibold text-neutral-700 mb-4">Estate Planning Flags</h3>
              <div className="space-y-4">
                <ToggleField
                  name="has_buy_sell_agreement"
                  label="Buy-Sell Agreement in place"
                  defaultChecked={editing?.has_buy_sell_agreement ?? false}
                  helpText="A legal agreement governing what happens to your ownership interest if you die, become disabled, or want to sell."
                />
                <ToggleField
                  name="buy_sell_funded"
                  label="Buy-Sell Agreement is funded by insurance"
                  defaultChecked={editing?.buy_sell_funded ?? false}
                  helpText="Is the buyout funded by a life insurance policy on the owners?"
                />
                <ToggleField
                  name="has_key_person_insurance"
                  label="Key Person Insurance in place"
                  defaultChecked={editing?.has_key_person_insurance ?? false}
                  helpText="Life or disability insurance on a key person whose loss would significantly impact business value."
                />
              </div>
            </div>

            <div className="border-t border-neutral-100 pt-5">
              <RefSelect
                name="succession_plan"
                label="Succession Plan"
                options={successionPlans}
                defaultValue={editing?.succession_plan}
                placeholder="Select succession plan..."
                helpText="What is the intended plan for this business when you retire or pass away?"
              />
            </div>

            <div className="border-t border-neutral-100 pt-5">
              <h3 className="text-sm font-semibold text-neutral-700 mb-2">Estate Inclusion</h3>
              <p className="text-xs text-neutral-500 mb-3">
                Mark this business interest as outside your taxable estate only when a legal
                transfer is complete and effective (e.g. gifted, placed in irrevocable trust).
                Consult your estate attorney before marking as excluded.
              </p>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Estate Status</label>
                <select
                  name="estate_inclusion_status"
                  defaultValue={editing?.estate_inclusion_status ?? 'included'}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="included">Included in taxable estate</option>
                  <option value="excluded_irrevocable">Irrevocable transfer — legally complete</option>
                  <option value="excluded_gifted">Gifted — transfer complete</option>
                  <option value="excluded_other">Other exclusion</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
              <textarea
                name="notes"
                defaultValue={editing?.notes ?? ''}
                rows={3}
                placeholder="Any additional context about this business interest..."
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition"
              >
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Business'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditing(null)
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
