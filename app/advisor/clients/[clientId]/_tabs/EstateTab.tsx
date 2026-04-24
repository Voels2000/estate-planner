'use client'
// app/advisor/clients/[clientId]/_tabs/EstateTab.tsx
// Estate planning view — documents, beneficiaries, titling, accounts

import { useEffect, useState } from 'react'
import { ClientViewShellProps } from '../_client-view-shell'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import { formatCurrency, formatDate } from '../_utils'
import BeneficiaryGrantPanel from './BeneficiaryGrantPanel'
import EstateFlowDiagram from '@/components/estate-flow/EstateFlowDiagram'
import { createClient } from '@/lib/supabase/client'
import { computeBusinessOwnershipValue } from '@/lib/my-estate-strategy/horizonSnapshots'
import EstateCompositionCard from '@/components/estate/EstateCompositionCard'

const ESTATE_DOC_TYPES = [
  { type: 'will',              label: 'Last Will & Testament',     critical: true },
  { type: 'trust',             label: 'Revocable Living Trust',    critical: false },
  { type: 'dpoa',              label: 'Durable Power of Attorney', critical: true },
  { type: 'medical_poa',       label: 'Medical Power of Attorney', critical: true },
  { type: 'advance_directive', label: 'Advance Directive',         critical: false },
  { type: 'living_will',       label: 'Living Will',               critical: false },
]

export default function EstateTab({
  advisorId,
  household,
  assets,
  liabilities,
  realEstate,
  businesses,
  insurancePolicies,
  businessInterests,
  beneficiaries,
  estateDocuments,
  conflictReport,
  beneficiaryGrants = [],
}: ClientViewShellProps) {
  const [deathView, setDeathView] = useState<'first_death' | 'second_death'>('first_death')
  const [hasCSTStrategy, setHasCSTStrategy] = useState<boolean>(false)
  const [composition, setComposition] = useState<import('@/lib/estate/types').EstateComposition | null>(null)
  const [adminExpensePct, setAdminExpensePct] = useState<number>(
    (household as any).admin_expense_pct ?? 0.02
  )
  const [savingAdminExpense, setSavingAdminExpense] = useState(false)
  const [savingBusinessId, setSavingBusinessId] = useState<string | null>(null)
  const [savingInsuranceId, setSavingInsuranceId] = useState<string | null>(null)
  const [bizInclusionStatus, setBizInclusionStatus] = useState<Record<string, string>>(
    Object.fromEntries(
      (businesses ?? []).map(b => [b.id, (b as any).estate_inclusion_status ?? 'included'])
    )
  )
  const [insInclusionStatus, setInsInclusionStatus] = useState<Record<string, string>>(
    Object.fromEntries(
      (insurancePolicies ?? []).map(p => [p.id, (p as any).estate_inclusion_status ?? 'included'])
    )
  )
  const [expandedBeneficiaryGroups, setExpandedBeneficiaryGroups] = useState<Record<string, boolean>>({})
  const docMap = Object.fromEntries((estateDocuments ?? []).map(d => [d.document_type, d]))

  // Live net worth — matches the consumer dashboard calculation exactly.
  // assets + real_estate_equity + business_value + non_ilit_insurance_death_benefit - liabilities
  const financialAssetsTotal = (assets ?? []).reduce(
    (s, a) => s + Number(a.value ?? 0),
    0,
  )
  const realEstateEquityTotal = (realEstate ?? []).reduce(
    (s, r) => s + Number(r.current_value ?? 0) - Number(r.mortgage_balance ?? 0),
    0,
  )
  const businessValueTotal = computeBusinessOwnershipValue(
    (businesses ?? []) as { estimated_value?: unknown; ownership_pct?: unknown }[],
    (businessInterests ?? []) as {
      fmv_estimated?: unknown
      total_entity_value?: unknown
      ownership_pct?: unknown
    }[],
  )
  const insuranceValue = (insurancePolicies ?? [])
    .filter(p => !p.is_ilit)
    .reduce((s, p) => s + Number(p.death_benefit ?? 0), 0)
  const liabilitiesTotal = (liabilities ?? []).reduce(
    (s, l) => s + Number(l.balance ?? 0),
    0,
  )
  const liveNetWorth =
    financialAssetsTotal +
    realEstateEquityTotal +
    businessValueTotal +
    insuranceValue -
    liabilitiesTotal

  const assetAccountType = (a: { type?: string | null; account_type?: string | null }) =>
    (a.type ?? a.account_type ?? '').toLowerCase()

  const retirementAssets = (assets ?? []).filter(a =>
    ['401k','ira','roth_ira','sep_ira','403b','457','pension'].includes(assetAccountType(a))
  )
  const beneficiaryGroups = (beneficiaries ?? []).reduce<Record<string, any[]>>((acc, b) => {
    const key = (b.account_type ?? 'unassigned').toString().toLowerCase()
    if (!acc[key]) acc[key] = []
    acc[key].push(b)
    return acc
  }, {})
  const beneficiaryGroupKeys = Object.keys(beneficiaryGroups).sort((a, b) => {
    if (a === 'unassigned') return 1
    if (b === 'unassigned') return -1
    return a.localeCompare(b)
  })

  const totalRE       = (realEstate ?? []).reduce((s, r) => s + (r.current_value   ?? 0), 0)
  const totalMortgage = (realEstate ?? []).reduce((s, r) => s + (r.mortgage_balance ?? 0), 0)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    const fetchHasCSTStrategy = async () => {
      const { data } = await supabase
        .from('strategy_configs')
        .select('id')
        .eq('household_id', household.id)
        .eq('strategy_type', 'credit_shelter_trust')
        .eq('is_active', true)
        .limit(1)

      if (!mounted) return
      setHasCSTStrategy((data?.length ?? 0) > 0)
    }

    fetchHasCSTStrategy()

    // Fetch estate composition for EstateCompositionCard
    const fetchComposition = async () => {
      try {
        const res = await fetch('/api/estate-composition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ householdId: household.id }),
        })
        if (res.ok) {
          const data = await res.json()
          if (mounted && data.success) setComposition(data)
        }
      } catch (e) {
        console.error('[EstateTab] composition fetch error:', e)
      }
    }

    fetchComposition()

    return () => {
      mounted = false
    }
  }, [household.id])

  useEffect(() => {
    setExpandedBeneficiaryGroups((prev) => {
      const next: Record<string, boolean> = {}
      beneficiaryGroupKeys.forEach((key, idx) => {
        next[key] = prev[key] ?? idx === 0
      })
      return next
    })
  }, [beneficiaryGroupKeys.join('|')])

  // ── Save helpers ─────────────────────────────────────────────────────────
  async function saveAdminExpense(pct: number) {
    setSavingAdminExpense(true)
    try {
      await fetch(`/api/households/${household.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_expense_pct: pct }),
      })
      // Refresh composition card
      const res = await fetch('/api/estate-composition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId: household.id }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success) setComposition(data)
      }
    } finally {
      setSavingAdminExpense(false)
    }
  }

  async function saveBusinessDiscount(
    businessId: string,
    field: 'dloc_pct' | 'dlom_pct' | 'estate_inclusion_status',
    value: number | string,
  ) {
    if (field === 'estate_inclusion_status') {
      setBizInclusionStatus(prev => ({ ...prev, [businessId]: value as string }))
    }
    setSavingBusinessId(businessId)
    try {
      const businessPatchResponse = await fetch(`/api/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      const businessPatchBody = await businessPatchResponse.json()
      const compositionRefreshResponse = await fetch('/api/estate-composition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId: household.id }),
      })
      if (compositionRefreshResponse.ok) {
        const data = await compositionRefreshResponse.json()
        if (data.success) setComposition(data)
      }
    } finally {
      setSavingBusinessId(null)
    }
  }

  async function saveInsuranceInclusion(policyId: string, status: string) {
    setInsInclusionStatus(prev => ({ ...prev, [policyId]: status }))
    setSavingInsuranceId(policyId)
    try {
      await fetch(`/api/insurance/${policyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estate_inclusion_status: status }),
      })
      const res = await fetch('/api/estate-composition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId: household.id }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success) setComposition(data)
      }
    } finally {
      setSavingInsuranceId(null)
    }
  }

  return (
    <div className="space-y-6">
      <DisclaimerBanner />

      {/* ── Estate Composition — Inside / Outside view ── */}
      {composition && (
        <EstateCompositionCard
          composition={composition}
          label={`${household.person1_first_name ?? 'Client'}'s Estate`}
          snapshotLabel="Current snapshot"
        />
      )}

      {/* ── Admin Expense Override ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-700">Admin Expense Estimate</p>
            <p className="text-xs text-slate-400 mt-0.5">
              IRS Form 706 deduction — executor fees, legal, accounting. Default 2%. Typical range 1–4%.
              Consult estate attorney for precise figure.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={+(adminExpensePct * 100).toFixed(2)}
                onChange={e => setAdminExpensePct(Number(e.target.value) / 100)}
                onBlur={e => saveAdminExpense(Number(e.target.value) / 100)}
                className="w-20 border border-slate-200 rounded px-2 py-1.5 text-sm text-right pr-6"
              />
              <span className="absolute right-2 top-1.5 text-xs text-slate-400">%</span>
            </div>
            {savingAdminExpense && (
              <span className="text-xs text-slate-400">Saving...</span>
            )}
          </div>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Estate Flow</h2>
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden text-sm">
            <button
              onClick={() => setDeathView('first_death')}
              className={`px-4 py-2 transition-colors ${
                deathView === 'first_death'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Spouse 1 First
            </button>
            <button
              onClick={() => setDeathView('second_death')}
              className={`px-4 py-2 transition-colors border-l border-gray-200 ${
                deathView === 'second_death'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Spouse 2 First
            </button>
          </div>
        </div>

        <EstateFlowDiagram
          householdId={household.id}
          scenarioId={household.base_case_scenario_id ?? null}
          advisorId={advisorId}
          isAdvisor={true}
          deathView={deathView}
          hasCSTStrategy={hasCSTStrategy}
          liveNetWorth={liveNetWorth}
        />
      </section>

      <div className="grid grid-cols-2 gap-6">

        {/* ── Estate Documents ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Core Estate Documents</h3>
          <div className="space-y-2.5">
            {ESTATE_DOC_TYPES.map(({ type, label, critical }) => {
              const doc       = docMap[type]
              const confirmed = doc?.exists === true
              return (
                <div key={type} className={`flex items-center justify-between p-3 rounded-lg ${
                  confirmed ? 'bg-emerald-50' : critical ? 'bg-red-50' : 'bg-slate-50'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`text-base ${confirmed ? 'text-emerald-600' : critical ? 'text-red-400' : 'text-slate-300'}`}>
                      {confirmed ? '✓' : critical ? '✗' : '○'}
                    </span>
                    <span className={`text-sm font-medium ${confirmed ? 'text-emerald-800' : critical ? 'text-red-700' : 'text-slate-500'}`}>
                      {label}
                    </span>
                    {critical && !confirmed && (
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Required</span>
                    )}
                  </div>
                  {confirmed && doc?.confirmed_at
                    ? <span className="text-xs text-slate-400">{formatDate(doc.confirmed_at)}</span>
                    : <span className="text-xs text-slate-400">Not confirmed</span>
                  }
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Beneficiary Designations ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Beneficiary Designations</h3>

          {(beneficiaries ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 rounded-lg bg-red-50 border border-red-200">
              <span className="text-2xl text-red-400 mb-1">!</span>
              <p className="text-sm font-medium text-red-700">No beneficiaries on file</p>
              <p className="text-xs text-red-500 mt-0.5">Review retirement accounts immediately</p>
            </div>
          ) : (
            <div className="space-y-4">
              {beneficiaryGroupKeys.map((groupKey) => {
                const groupItems = beneficiaryGroups[groupKey] ?? []
                const isOpen = expandedBeneficiaryGroups[groupKey] ?? false
                const primaryCount = groupItems.filter((b) => !b.contingent).length
                const contingentCount = groupItems.filter((b) => b.contingent).length
                return (
                  <div key={groupKey} className="rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedBeneficiaryGroups((prev) => ({ ...prev, [groupKey]: !isOpen }))
                      }
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          {formatAccountTypeLabel(groupKey)}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {primaryCount} primary{contingentCount > 0 ? ` · ${contingentCount} contingent` : ''}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">{isOpen ? 'Hide' : 'Show'} ({groupItems.length})</span>
                    </button>
                    {isOpen && (
                      <div className="px-2 pb-2 space-y-1.5">
                        {groupItems.map((b) => (
                          <BeneficiaryRow key={b.id} b={b} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {(beneficiaries ?? []).some((b) => !b.contingent) &&
                !(beneficiaries ?? []).some((b) => b.contingent) && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs text-amber-700 font-medium">No contingent beneficiary designated</p>
                  <p className="text-xs text-amber-600 mt-0.5">Recommend adding contingent beneficiary to avoid lapse risk.</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500">
              Retirement accounts on file: <span className="font-semibold text-slate-700">{retirementAssets.length}</span>
            </p>
          </div>
        </div>
      </div>

      {/* -- Conflict Detector Panel (Sprint 58) -- */}
      {conflictReport && conflictReport.conflicts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-slate-700">Estate Conflicts</h3>
              {conflictReport.critical > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {conflictReport.critical} critical
                </span>
              )}
              {conflictReport.warnings > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  {conflictReport.warnings} warning{conflictReport.warnings !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2 px-5 py-3">Severity</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2 py-3">Issue</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2 py-3">Recommended Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {conflictReport.conflicts.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          c.severity === 'critical'
                            ? 'bg-red-100 text-red-700'
                            : c.severity === 'warning'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {c.severity}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-700 max-w-xs">{c.description}</td>
                    <td className="py-3 pr-5 text-slate-500 text-xs max-w-xs">{c.recommended_action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-100">
            <DisclaimerBanner context="conflict analysis" />
          </div>
        </div>
      )}

      {/* ── Business Interests & Valuation Discounts ── */}
      {(businesses ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Business Interests</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                DLOC/DLOM discounts apply to taxable estate only, not gross estate.
                Appraiser-supplied values only — requires qualified appraisal for Form 706.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">Business</th>
                  <th className="text-right text-xs font-semibold text-slate-500 pb-2">FMV (Gross)</th>
                  <th className="text-right text-xs font-semibold text-slate-500 pb-2">Ownership</th>
                  <th className="text-right text-xs font-semibold text-slate-500 pb-2 pl-3">DLOC %</th>
                  <th className="text-right text-xs font-semibold text-slate-500 pb-2 pl-2">DLOM %</th>
                  <th className="text-right text-xs font-semibold text-slate-500 pb-2">Taxable Value</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2 pl-3">Estate Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(businesses ?? []).map(b => {
                  const biz = b as any
                  const ownershipPct = (biz.ownership_pct ?? 100) / 100
                  const grossValue = (biz.estimated_value ?? 0) * ownershipPct
                  const dloc = biz.dloc_pct ?? 0
                  const dlom = biz.dlom_pct ?? 0
                  const combinedDiscount = 1 - (1 - dloc) * (1 - dlom)
                  const taxableValue = grossValue * (1 - combinedDiscount)
                  const isExcluded = biz.estate_inclusion_status !== 'included'
                  return (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-2.5 font-medium text-slate-800">
                        {b.name}
                        {isExcluded && (
                          <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Outside estate</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-slate-700">{formatCurrency(grossValue)}</td>
                      <td className="py-2.5 text-right text-slate-500">{biz.ownership_pct ?? 100}%</td>
                      <td className="py-2.5 text-right pl-3">
                        <input
                          type="number"
                          min="0"
                          max="99"
                          step="1"
                          disabled={isExcluded}
                          defaultValue={+(dloc * 100).toFixed(1)}
                          onBlur={e => saveBusinessDiscount(b.id, 'dloc_pct', Number(e.target.value) / 100)}
                          className="w-16 border border-slate-200 rounded px-2 py-1 text-xs text-right disabled:opacity-40"
                          title="Discount for Lack of Control — appraiser-supplied"
                        />
                        <span className="text-xs text-slate-400 ml-0.5">%</span>
                      </td>
                      <td className="py-2.5 text-right pl-2">
                        <input
                          type="number"
                          min="0"
                          max="99"
                          step="1"
                          disabled={isExcluded}
                          defaultValue={+(dlom * 100).toFixed(1)}
                          onBlur={e => saveBusinessDiscount(b.id, 'dlom_pct', Number(e.target.value) / 100)}
                          className="w-16 border border-slate-200 rounded px-2 py-1 text-xs text-right disabled:opacity-40"
                          title="Discount for Lack of Marketability — appraiser-supplied"
                        />
                        <span className="text-xs text-slate-400 ml-0.5">%</span>
                      </td>
                      <td className="py-2.5 text-right font-medium text-slate-800">
                        {isExcluded ? (
                          <span className="text-slate-400 text-xs">—</span>
                        ) : (
                          formatCurrency(taxableValue)
                        )}
                        {combinedDiscount > 0 && !isExcluded && (
                          <span className="block text-[10px] text-green-600">
                            {(combinedDiscount * 100).toFixed(1)}% discount
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pl-3">
                        {isExcluded ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            ✓ Outside estate
                          </span>
                        ) : (
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                            Inside estate
                          </span>
                        )}
                        <p className="text-[10px] text-slate-400 mt-0.5">Client sets in /businesses</p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            DLOC + DLOM are applied multiplicatively: combined = 1 − (1−DLOC) × (1−DLOM).
            Requires qualified appraisal per IRC §2031. Do not use estimated discounts.
          </p>
        </div>
      )}

      {/* ── Real Estate & Titling ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">Real Estate & Titling</h3>
          <div className="text-right">
            <span className="text-sm font-bold text-slate-800">{formatCurrency(totalRE - totalMortgage)}</span>
            <span className="text-xs text-slate-400 ml-1">equity</span>
          </div>
        </div>

        {(realEstate ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">No real estate on file</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">Property</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">Type</th>
                  <th className="text-right text-xs font-semibold text-slate-500 pb-2">Value</th>
                  <th className="text-right text-xs font-semibold text-slate-500 pb-2">Mortgage</th>
                  <th className="text-right text-xs font-semibold text-slate-500 pb-2">Equity</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2 pl-4">Owner</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2 pl-4">State</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2 pl-4">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(realEstate ?? []).map(r => {
                  const equity     = (r.current_value ?? 0) - (r.mortgage_balance ?? 0)
                  const soleOwner  = household.has_spouse && (r.owner === 'person1' || r.owner === 'person2')
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-2.5 font-medium text-slate-800">
                        {r.name}
                        {r.is_primary_residence && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Primary</span>
                        )}
                      </td>
                      <td className="py-2.5 text-slate-500 capitalize">{formatPropertyType(r.property_type)}</td>
                      <td className="py-2.5 text-right text-slate-800">{formatCurrency(r.current_value)}</td>
                      <td className="py-2.5 text-right text-slate-500">{r.mortgage_balance ? formatCurrency(r.mortgage_balance) : '—'}</td>
                      <td className="py-2.5 text-right font-medium text-emerald-700">{formatCurrency(equity)}</td>
                      <td className="py-2.5 pl-4 text-slate-500">{formatOwner(r.owner, household)}</td>
                      <td className="py-2.5 pl-4 text-slate-500">{r.situs_state ?? '—'}</td>
                      <td className="py-2.5 pl-4">
                        {soleOwner && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Review titling</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Insurance Policies & Estate Inclusion ── */}
      {(insurancePolicies ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Insurance Policies</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Estate-owned policies are included at death benefit value. Mark as excluded when
                ILIT transfer is complete and effective.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">Policy</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">Type</th>
                  <th className="text-right text-xs font-semibold text-slate-500 pb-2">Death Benefit</th>
                  <th className="text-right text-xs font-semibold text-slate-500 pb-2">Cash Value</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2 pl-3">Estate Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(insurancePolicies ?? []).map(p => {
                  const pol = p as any
                  const isExcluded = pol.estate_inclusion_status === 'excluded_irrevocable'
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2.5 font-medium text-slate-800">
                        {p.policy_name ?? p.provider ?? 'Policy'}
                        {p.is_ilit && (
                          <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">ILIT</span>
                        )}
                      </td>
                      <td className="py-2.5 text-slate-500 capitalize text-xs">
                        {p.insurance_type?.replace(/_/g, ' ') ?? '—'}
                      </td>
                      <td className="py-2.5 text-right text-slate-800">
                        {p.death_benefit ? formatCurrency(p.death_benefit) : '—'}
                        {isExcluded && (
                          <span className="block text-[10px] text-green-600">Outside estate</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-slate-500">
                        {p.cash_value ? formatCurrency(p.cash_value) : '—'}
                      </td>
                      <td className="py-2.5 pl-3">
                        <select
                          value={insInclusionStatus[p.id] ?? 'included'}
                          onChange={e => saveInsuranceInclusion(p.id, e.target.value)}
                          disabled={savingInsuranceId === p.id}
                          className="text-xs border border-slate-200 rounded px-2 py-1 bg-white disabled:opacity-40"
                        >
                          <option value="included">Included in estate</option>
                          <option value="excluded_irrevocable">ILIT — transfer complete</option>
                          <option value="excluded_other">Other exclusion</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Only mark as excluded when the ILIT transfer is legally complete and effective.
            An incomplete transfer may still be included in the gross estate under IRC §2035.
          </p>
        </div>
      )}

      {/* ── Retirement & Investment Accounts ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Retirement & Investment Accounts</h3>
        {(assets ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">No assets on file</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">Account</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">Type</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">Owner</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">Titling</th>
                  <th className="text-right text-xs font-semibold text-slate-500 pb-2">Value</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2 pl-4">Liquidity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(assets ?? []).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="py-2.5 font-medium text-slate-800">{a.name}</td>
                    <td className="py-2.5">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">
                        {a.type ?? a.account_type ?? a.asset_type ?? '—'}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-500">{formatOwner(a.owner, household)}</td>
                    <td className="py-2.5 text-slate-500">{a.titling ?? a.institution ?? '—'}</td>
                    <td className="py-2.5 text-right font-medium text-slate-800">{formatCurrency(a.value)}</td>
                    <td className="py-2.5 pl-4">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {a.liquidity ?? '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BeneficiaryGrantPanel householdId={household.id} initialGrants={beneficiaryGrants} />

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BeneficiaryRow({ b }: { b: any }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50">
      <div>
        <span className="text-sm font-medium text-slate-800">{b.name}</span>
        <span className="text-xs text-slate-400 ml-2">{b.relationship}</span>
        {b.contingent && (
          <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Contingent</span>
        )}
      </div>
      <div className="text-right">
        <span className="text-sm font-semibold text-slate-700">{b.allocation_pct ? `${b.allocation_pct}%` : '—'}</span>
        {b.account_type && <span className="text-xs text-slate-400 ml-1.5">{b.account_type}</span>}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatOwner(owner: string | null, household: any) {
  if (!owner) return '—'
  if (owner === 'person1') return household.person1_first_name ?? 'Person 1'
  if (owner === 'person2') return household.person2_first_name ?? 'Person 2'
  if (owner === 'joint')   return 'Joint'
  return owner
}

function formatPropertyType(t: string | null) {
  if (!t) return '—'
  return t.replace(/_/g, ' ')
}

function formatAccountTypeLabel(t: string) {
  if (!t || t === 'unassigned') return 'Unassigned'
  return t
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
