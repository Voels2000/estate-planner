'use client'
// app/advisor/clients/[clientId]/_tabs/EstateTab.tsx
// Estate planning view — documents, beneficiaries, titling, accounts

import { ClientViewShellProps } from '../_client-view-shell'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import { formatCurrency, formatDate } from '../_utils'

const ESTATE_DOC_TYPES = [
  { type: 'will',              label: 'Last Will & Testament',     critical: true },
  { type: 'trust',             label: 'Revocable Living Trust',    critical: false },
  { type: 'dpoa',              label: 'Durable Power of Attorney', critical: true },
  { type: 'medical_poa',       label: 'Medical Power of Attorney', critical: true },
  { type: 'advance_directive', label: 'Advance Directive',         critical: false },
  { type: 'living_will',       label: 'Living Will',               critical: false },
]

export default function EstateTab({
  household,
  assets,
  realEstate,
  beneficiaries,
  estateDocuments,
  conflictReport,
}: ClientViewShellProps) {
  const docMap = Object.fromEntries((estateDocuments ?? []).map(d => [d.document_type, d]))

  const retirementAssets = (assets ?? []).filter(a =>
    ['401k','ira','roth_ira','sep_ira','403b','457','pension'].includes(a.account_type?.toLowerCase() ?? '')
  )
  const primaryBeneficiaries   = (beneficiaries ?? []).filter(b => !b.contingent)
  const contingentBeneficiaries = (beneficiaries ?? []).filter(b =>  b.contingent)

  const totalRE       = (realEstate ?? []).reduce((s, r) => s + (r.current_value   ?? 0), 0)
  const totalMortgage = (realEstate ?? []).reduce((s, r) => s + (r.mortgage_balance ?? 0), 0)

  return (
    <div className="space-y-6">

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
              {primaryBeneficiaries.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Primary</p>
                  <div className="space-y-1.5">
                    {primaryBeneficiaries.map(b => (
                      <BeneficiaryRow key={b.id} b={b} />
                    ))}
                  </div>
                </div>
              )}
              {contingentBeneficiaries.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Contingent</p>
                  <div className="space-y-1.5">
                    {contingentBeneficiaries.map(b => (
                      <BeneficiaryRow key={b.id} b={b} />
                    ))}
                  </div>
                </div>
              )}
              {primaryBeneficiaries.length > 0 && contingentBeneficiaries.length === 0 && (
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
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">Institution</th>
                  <th className="text-right text-xs font-semibold text-slate-500 pb-2">Value</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2 pl-4">Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(assets ?? []).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="py-2.5 font-medium text-slate-800">{a.name}</td>
                    <td className="py-2.5">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">{a.account_type ?? a.asset_type ?? '—'}</span>
                    </td>
                    <td className="py-2.5 text-slate-500">{formatOwner(a.owner, household)}</td>
                    <td className="py-2.5 text-slate-500">{a.institution ?? '—'}</td>
                    <td className="py-2.5 text-right font-medium text-slate-800">{formatCurrency(a.value)}</td>
                    <td className="py-2.5 pl-4">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${a.is_taxable ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                        {a.is_taxable ? 'Taxable' : 'Tax-adv.'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
