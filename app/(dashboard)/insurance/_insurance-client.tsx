
"use client"

import { useState } from "react"
import { InsurancePolicy, InsuranceType, analyzeGaps, formatCurrency, HouseholdProfile } from "@/lib/insurance"

interface Props {
  initialPolicies: InsurancePolicy[]
  profile: HouseholdProfile | null
}

const TYPE_LABELS: Record<InsuranceType, string> = {
  life: "Life Insurance",
  disability: "Disability Insurance",
  ltc: "Long-Term Care",
  property_casualty: "Property & Casualty",
}

const TYPE_COLORS: Record<InsuranceType, string> = {
  life: "blue",
  disability: "violet",
  ltc: "amber",
  property_casualty: "emerald",
}

const EMPTY_FORM: Partial<InsurancePolicy> = {
  insurance_type: "life",
  provider: "",
  policy_name: "",
  coverage_amount: undefined,
  monthly_premium: undefined,
  death_benefit: undefined,
  monthly_benefit: undefined,
  daily_benefit: undefined,
  policy_subtype: undefined,
  is_employer_provided: false,
  property_type: undefined,
  covered_members: [],
  notes: "",
}

export function InsuranceClient({ initialPolicies, profile }: Props) {
  const [policies, setPolicies] = useState<InsurancePolicy[]>(initialPolicies)
  const [activeTab, setActiveTab] = useState<"overview" | InsuranceType>("overview")
  const [showModal, setShowModal] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(null)
  const [form, setForm] = useState<Partial<InsurancePolicy>>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const defaultProfile: HouseholdProfile = {
    annual_income: profile?.annual_income || 100000,
    age: profile?.age || 45,
    spouse_age: profile?.spouse_age,
    dependents: profile?.dependents || 0,
    total_assets: profile?.total_assets || 500000,
    total_debts: profile?.total_debts || 200000,
    monthly_expenses: profile?.monthly_expenses || 5000,
    has_spouse: profile?.has_spouse || false,
  }

  const gaps = analyzeGaps(defaultProfile, policies)

  const openAdd = () => {
    setEditingPolicy(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (policy: InsurancePolicy) => {
    setEditingPolicy(policy)
    setForm(policy)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingPolicy(null)
    setForm(EMPTY_FORM)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      if (editingPolicy) {
        const res = await fetch(`/api/insurance/${editingPolicy.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        const updated = await res.json()
        if (updated.error) { setSaveError(updated.error); return }
        setPolicies(prev => prev.map(p => p.id === updated.id ? updated : p))
      } else {
        const res = await fetch("/api/insurance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        const created = await res.json()
        if (created.error) { setSaveError(created.error); return }
        setPolicies(prev => [...prev, created])
      }
      closeModal()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await fetch(`/api/insurance/${id}`, { method: "DELETE" })
      setPolicies(prev => prev.filter(p => p.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const filteredPolicies = activeTab === "overview"
    ? policies
    : policies.filter(p => p.insurance_type === activeTab)

  const tabs = ["overview", "life", "disability", "ltc", "property_casualty"] as const

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insurance Gap Analysis</h1>
          <p className="text-sm text-gray-500 mt-1">Track your policies and identify coverage gaps</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Add Policy
        </button>
      </div>

      {/* Gap Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {gaps.map(gap => (
          <div key={gap.type} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <p className="text-xs font-medium text-gray-500">{gap.label}</p>
            <div className="flex items-end justify-between">
              <span className={`text-xl font-bold ${gap.status === "adequate" ? "text-emerald-600" : "text-red-500"}`}>
                {gap.gap_pct}%
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                gap.status === "adequate"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-600"
              }`}>
                {gap.status === "adequate" ? "Adequate" : "Gap"}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${gap.status === "adequate" ? "bg-emerald-500" : "bg-red-400"}`}
                style={{ width: `${Math.min(gap.gap_pct, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">
              {gap.unit === "$" || gap.unit === "$/mo" || gap.unit === "$/day"
                ? `${formatCurrency(gap.current)} of ${formatCurrency(gap.recommended)} rec.`
                : `${gap.current} of ${gap.recommended} rec.`}
            </p>
          </div>
        ))}
      </div>

      {/* Insights */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-blue-800">Coverage Insights</p>
        {gaps.map(gap => (
          <div key={gap.type} className="flex gap-2 text-sm text-blue-700">
            <span>{gap.status === "adequate" ? "✅" : "⚠️"}</span>
            <span>{gap.insight}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "overview" ? "All Policies" : TYPE_LABELS[tab as InsuranceType]}
            {tab !== "overview" && (
            <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                {policies.filter(p => p.insurance_type === tab).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Policy List */}
      {filteredPolicies.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🛡️</p>
          <p className="font-medium text-gray-500">No policies added yet</p>
          <p className="text-sm mt-1">Add your existing policies to see your coverage gaps</p>
          <button onClick={openAdd} className="mt-4 text-sm text-blue-600 hover:underline">
            + Add your first policy
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPolicies.map(policy => (
            <div key={policy.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                  policy.insurance_type === "life" ? "bg-blue-50" :
                  policy.insurance_type === "disability" ? "bg-violet-50" :
                  policy.insurance_type === "ltc" ? "bg-amber-50" : "bg-emerald-50"
                }`}>
                  {policy.insurance_type === "life" ? "💙" :
                   policy.insurance_type === "disability" ? "🛡️" :
                   policy.insurance_type === "ltc" ? "🏥" : "🏠"}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {policy.policy_name || policy.provider || TYPE_LABELS[policy.insurance_type]}
                  </p>
                  <p className="text-xs text-gray-500">
                    {TYPE_LABELS[policy.insurance_type]}
                    {policy.provider && policy.policy_name ? ` · ${policy.provider}` : ""}
                    {policy.is_employer_provided ? " · Employer" : ""}
                  </p>
                  {policy.covered_members && policy.covered_members.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Covers: {policy.covered_members.map((m: string) =>
                        m === "person1" ? "You" : m === "person2" ? "Spouse" : "Dependents"
                      ).join(", ")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-gray-900">
                    {policy.insurance_type === "life"
                      ? formatCurrency(policy.death_benefit || policy.coverage_amount || 0)
                      : policy.insurance_type === "disability"
                        ? `${formatCurrency(policy.monthly_benefit || 0)}/mo`
                        : policy.insurance_type === "ltc"
                          ? `$${policy.daily_benefit || 0}/day`
                          : formatCurrency(policy.coverage_amount || 0)}
                  </p>
                  {policy.monthly_premium && (
                    <p className="text-xs text-gray-400">{formatCurrency(policy.monthly_premium)}/mo premium</p>
                  )}
                </div>
                <div className="flex ga-2">
                  <button
                    onClick={() => openEdit(policy)}
                    className="text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(policy.id)}
                    disabled={deletingId === policy.id}
                    className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
                  >
                    {deletingId === policy.id ? "..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingPolicy ? "Edit Policy" : "Add Policy"}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Type</label>
                <select
                  value={form.insurance_type}
                  onChange={e => setForm(f => ({ ...f, insurance_type: e.target.value as InsuranceType }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {Object.entries(TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Provider & Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                  <input
                    type="text"
                    placeholder="e.g. MetLife"
                    value={form.provider || ""}
                    onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Policy Name</label>
                  <input
                    type="text"
                    placeholder="e.g. 20-Year Term"
                    value={form.policy_name || ""}
                    onChange={e => setForm(f => ({ ...f, policy_name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Life-specific */}
              {form.insurance_type === "life" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subtype</label>
                      <select
                        value={form.policy_subtype || ""}
                        onChange={e => setForm(f => ({ ...f, policy_subtype: e.target.value as any }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Select...</option>
                        <option value="term">Term</option>
                        <option value="whole">Whole</option>
                        <option value="universal">Universal</option>
                        <option value="variable">Variable</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Death Benefit ($)</label>
                      <input
                        type="number"
                        placeholder="500000"
                        value={form.death_benefit || ""}
                        onChange={e => setForm(f => ({ ...f, death_benefit: Number(e.target.value) }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  {form.policy_subtype === "term" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Term Length (years)</label>
                      <input
                        type="number"
                        placeholder="20"
                        value={form.term_years || ""}
                        onChange={e => setForm(f => ({ ...f, term_years: Number(e.target.value) }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Disability-specific */}
              {form.insurance_type === "disability" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Benefit ($)</label>
                    <input
                      type="number"
                      placeholder="5000"
                      value={form.monthly_benefit || ""}
                      onChange={e => setForm(f => ({ ...f, monthly_benefit: Number(e.target.value) }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Benefit Period</label>
                    <select
                      value={form.benefit_period || ""}
                      onChange={e => setForm(f => ({ ...f, benefit_period: e.target.value as any }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Select...</option>
                      <option value="2yr">2 Years</option>
                      <option value="5yr">5 Years</option>
                      <option value="to65">To Age 65</option>
                      <option value="lifetime">Lifetime</option>
                    </select>
                  </div>
                </div>
              )}

              {/* LTC-specific */}
              {form.insurance_type === "ltc" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Daily Benefit ($)</label>
                    <input
                      type="number"
                      placeholder="200"
                      value={form.daily_benefit || ""}
                      onChange={e => setForm(f => ({ ...f, daily_benefit: Number(e.target.value) }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Benefit Period</label>
                    <input
                      type="text"
                      placeholder="e.g. 3 years"
                      value={form.ltc_benefit_period || ""}
                      onChange={e => setForm(f => ({ ...f, ltc_benefit_period: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* P&C-specific */}
              {form.insurance_type === "property_casualty" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                    <select
                      value={form.property_type || ""}
                      onChange={e => setForm(f => ({ ...f, property_type: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Select...</option>
                      <option value="home">Home / Renters</option>
                      <option value="auto">Auto</option>
                      <option value="umbrella">Umbrella</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Coverage Amount ($)</label>
                    <input
                      type="number"
                      placeholder="300000"
                      value={form.coverage_amount || ""}
                      onChange={e => setForm(f => ({ ...f, coverage_amount: Number(e.target.value) }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Premium */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Premium ($)</label>
                  <input
                    type="number"
                    placeholder="150"
                    value={form.monthly_premium || ""}
                    onChange={e => setForm(f => ({ ...f, monthly_premium: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_employer_provided || false}
                      onChange={e => setForm(f => ({ ...f, is_employer_provided: e.target.checked }))}
                      className="rounded"
                    />
                    Employer provided
                  </label>
                </div>
              </div>

              {/* Covered Members */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Who is covered?</label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { key: "person1", label: "You" },
                    { key: "person2", label: "Spouse / Partner" },
                    { key: "dependents", label: "Dependents" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(form.covered_members || []).includes(key)}
                        onChange={e => {
                          const current = form.covered_members || []
                          const updated = e.target.checked
                            ? [...current, key]
                            : current.filter((m: string) => m !== key)
                          setForm(f => ({ ...f, covered_members: updated }))
                        }}
                        className="rounded"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes..."
                  value={form.notes || ""}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 space-y-3">
              {saveError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
              )}
              <div className="flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg"
              >
                {saving ? "Saving..." : editingPolicy ? "Save Changes" : "Add Policy"}
              </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
