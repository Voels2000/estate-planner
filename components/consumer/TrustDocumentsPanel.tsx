'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import {
  PLANNING_TOPICS_SECTION_INTRO,
  TRUST_PREVALENCE_CARD_CLASS,
  TRUST_PREVALENCE_LABELS,
} from '@/lib/estate/planningTopicPresentation'
import type {
  TrustRow,
  TrustWillChecklistItem,
  TrustWillRecommendation,
} from '@/lib/trusts/types'
import { formatDollars } from '@/lib/utils/formatCurrency'
import { HEADROOM_BEFORE_FEDERAL_TAX_LABEL } from '@/lib/estate/exemptionLabels'
import { estimateTrustTaxSaved } from '@/lib/trusts/trustEstateTaxEstimate'
import { TRUST_TASK_TO_CHECKLIST_KEY } from '@/lib/estate/estateChecklistTaskKeys'

export type { TrustRow } from '@/lib/trusts/types'

export type TrustEstateSummary = {
  estimatedTaxableEstate: number
  federalExemptionRemaining: number
  lifetimeGiftsUsed: number
  headroom: number
}

export type TrustDocumentsPanelProps = {
  estateValue: number
  recommendations: TrustWillRecommendation[]
  checklist: TrustWillChecklistItem[]
  initialTrusts?: TrustRow[]
  embedded?: boolean
  trustEstateSummary?: TrustEstateSummary
  marginalStateEstateRatePct?: number
  /** Persisted completion from estate_checklist_items (task_key → completed). */
  persistedChecklist?: Record<string, boolean>
}

const TRUST_TYPES = [
  { value: 'revocable', label: 'Revocable' },
  { value: 'irrevocable', label: 'Irrevocable' },
  { value: 'qtip', label: 'QTIP' },
  { value: 'bypass', label: 'Bypass' },
  { value: 'charitable', label: 'Charitable' },
  { value: 'special_needs', label: 'Special needs' },
] as const

function num(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v !== '') return Number(v) || 0
  return 0
}

const inputClass =
  'block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500'

export function TrustDocumentsPanel({
  estateValue,
  recommendations,
  checklist,
  initialTrusts = [],
  embedded = false,
  trustEstateSummary,
  marginalStateEstateRatePct = 0,
  persistedChecklist = {},
}: TrustDocumentsPanelProps) {
  const router = useRouter()
  const keyPrefix = embedded ? 'trust-strategy-docs' : 'trust-will'
  const [trusts, setTrusts] = useState<TrustRow[]>(initialTrusts)
  const [showTrustModal, setShowTrustModal] = useState(false)
  const [editTrust, setEditTrust] = useState<TrustRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    setTrusts(initialTrusts)
  }, [initialTrusts])

  function openAddTrust() { setEditTrust(null); setShowTrustModal(true); setError(null) }
  function openEditTrust(t: TrustRow) { setEditTrust(t); setShowTrustModal(true); setError(null) }

  async function handleDeleteTrust(id: string) {
    const confirmed = window.confirm('Delete this trust? This action cannot be undone.')
    if (!confirmed) return
    setDeletingId(id)
    setError(null)
    const res = await fetch('/api/consumer/trusts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to delete trust')
      setDeletingId(null)
      return
    }
    setTrusts((prev) => prev.filter((t) => t.id !== id))
    setDeletingId(null)
    router.refresh()
  }

  return (
    <div className={embedded ? 'space-y-6' : 'max-w-3xl mx-auto px-6 py-10 space-y-6'}>
      <div className="flex items-start justify-between gap-4">
        <div>
          {!embedded && (
            <h1 className="text-2xl font-bold text-neutral-900">Trust & Will Guidance</h1>
          )}
          {embedded && (
            <h2 className="text-base font-semibold text-gray-800">Trusts & estate documents</h2>
          )}
          <p className={`text-sm text-neutral-600 ${embedded ? 'mt-1' : 'mt-2'}`}>
            <span className="font-medium text-neutral-700">Trust types you can add:</span>{' '}
            {TRUST_TYPES.map((t) => t.label).join(', ')}.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddTrust}
          className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition"
        >
          + Add Trust
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {trustEstateSummary ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Estimated Taxable Estate
            </p>
            <p className="mt-1 text-lg font-semibold text-neutral-900 tabular-nums">
              {formatDollars(trustEstateSummary.estimatedTaxableEstate)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Federal exemption remaining
            </p>
            <p className="mt-1 text-lg font-semibold text-neutral-900 tabular-nums">
              {formatDollars(trustEstateSummary.federalExemptionRemaining)}
            </p>
            {trustEstateSummary.lifetimeGiftsUsed > 0 && (
              <p className="mt-0.5 text-xs text-neutral-500">
                after {formatDollars(trustEstateSummary.lifetimeGiftsUsed)} lifetime gifts
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {HEADROOM_BEFORE_FEDERAL_TAX_LABEL}
            </p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--mwm-sage)] tabular-nums">
              {formatDollars(trustEstateSummary.headroom)}
            </p>
          </div>
        </div>
      ) : (
        <CollapsibleSection
          title="Estimated Taxable Estate"
          defaultOpen={true}
          storageKey={`${keyPrefix}-estimated-estate-value`}
        >
          <p className="text-2xl font-bold text-neutral-900 tabular-nums">
            {formatDollars(estateValue)}
          </p>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title="Trusts on file"
        subtitle={trusts.length > 0 ? `${trusts.length} trust${trusts.length === 1 ? '' : 's'}` : 'No trusts added yet'}
        defaultOpen={true}
        storageKey={`${keyPrefix}-trusts`}
      >
        <div className="rounded-xl border border-neutral-200 overflow-hidden overflow-x-auto">
          {trusts.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-neutral-500">
              No trusts yet.{' '}
              <button
                type="button"
                onClick={openAddTrust}
                className="text-neutral-900 font-medium underline underline-offset-2 hover:opacity-70"
              >
                Add a trust
              </button>{' '}
              to model excluded funding and see the impact on your estate tax.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-neutral-100">
              <thead className="bg-neutral-50">
                <tr>
                  {[
                    'Name',
                    'Type',
                    'Grantor',
                    'Trustee',
                    'Funding',
                    'Est. Tax Saved',
                    'Excludes from estate',
                    '',
                  ].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {trusts.map((t) => {
                  const funding = num(t.funding_amount ?? t.excluded_from_estate)
                  const excludes = t.excludes_from_estate === true
                  const taxSaved = excludes
                    ? estimateTrustTaxSaved(funding, marginalStateEstateRatePct)
                    : 0
                  return (
                  <tr key={t.id} className="hover:bg-neutral-50/80">
                    <td className="px-4 py-3 text-sm font-medium text-neutral-900">{t.name}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {TRUST_TYPES.find((x) => x.value === (t.trust_type || 'revocable'))?.label ?? t.trust_type}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{t.grantor || '-'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{t.trustee || '-'}</td>
                    <td className="px-4 py-3 text-sm tabular-nums text-neutral-900">
                      {formatDollars(funding)}
                    </td>
                    <td
                      className="px-4 py-3 text-sm tabular-nums text-neutral-700"
                      title={
                        excludes
                          ? 'Estimated based on current marginal state estate tax rate.'
                          : undefined
                      }
                    >
                      {excludes && taxSaved > 0 ? `~${formatDollars(taxSaved)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={t.excludes_from_estate || num(t.excluded_from_estate) > 0 ? 'text-green-700 font-medium' : 'text-neutral-400'}>
                        {t.excludes_from_estate || num(t.excluded_from_estate) > 0 ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEditTrust(t)}
                        className="text-sm font-medium text-neutral-700 hover:text-neutral-900 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteTrust(t.id)}
                        disabled={deletingId === t.id}
                        className="text-sm font-medium text-red-700 hover:text-red-900 disabled:opacity-50"
                      >
                        {deletingId === t.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Common planning topics"
        defaultOpen={false}
        storageKey={`${keyPrefix}-foundational-documents`}
      >
        <p className="mb-4 text-sm text-neutral-500">{PLANNING_TOPICS_SECTION_INTRO}</p>
        {recommendations.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No topics to display at this time based on your profile inputs.
          </p>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div key={rec.title} className={`rounded-xl border px-5 py-4 ${TRUST_PREVALENCE_CARD_CLASS[rec.priority]}`}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <p className="font-semibold text-sm">{rec.title}</p>
                  <span className="shrink-0 text-xs font-medium text-right opacity-80">
                    {TRUST_PREVALENCE_LABELS[rec.priority]}
                  </span>
                </div>
                <p className="text-sm opacity-80">{rec.description}</p>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Action Checklist"
        defaultOpen={false}
        storageKey={`${keyPrefix}-action-checklist`}
      >
        <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 -m-2">
          {checklist.map((item, i) => {
            const taskKey = TRUST_TASK_TO_CHECKLIST_KEY[item.task]
            const checked = taskKey
              ? (persistedChecklist[taskKey] ?? item.completed)
              : item.completed

            return (
              <div key={i} className="flex items-start gap-3 px-5 py-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-neutral-900"
                  checked={checked}
                  onChange={async (e) => {
                    if (!taskKey) return
                    const completed = e.target.checked
                    await fetch('/api/consumer/estate-checklist', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ task_key: taskKey, completed }),
                    })
                    router.refresh()
                  }}
                />
                <p className="text-sm text-neutral-700">{item.task}</p>
              </div>
            )
          })}
        </div>
      </CollapsibleSection>

      <p className="text-xs text-neutral-400 border-t border-neutral-100 pt-6">
        This guidance is generated based on information you have entered into Estate Planner.
        It is not legal advice. Always consult a licensed estate planning attorney in your state
        before making decisions about trusts, wills, or estate documents.
      </p>

      {showTrustModal && (
        <TrustModal
          editRow={editTrust}
          onClose={() => { setShowTrustModal(false); setEditTrust(null) }}
          onSaved={async (saved) => {
            setShowTrustModal(false)
            setEditTrust(null)
            setTrusts((prev) => {
              const idx = prev.findIndex((t) => t.id === saved.id)
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = saved
                return next
              }
              return [saved, ...prev]
            })
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Trust modal
// ─────────────────────────────────────────────────────────────

function TrustModal({
  editRow,
  onClose,
  onSaved,
}: {
  editRow: TrustRow | null
  onClose: () => void
  onSaved: (saved: TrustRow) => Promise<void>
}) {
  const [name, setName] = useState(editRow?.name ?? '')
  const [trustType, setTrustType] = useState(editRow?.trust_type ?? 'revocable')
  const [grantor, setGrantor] = useState(editRow?.grantor ?? '')
  const [trustee, setTrustee] = useState(editRow?.trustee ?? '')
  const [fundingAmount, setFundingAmount] = useState(
    editRow != null ? String(num(editRow.funding_amount ?? editRow.excluded_from_estate)) : '0',
  )
  const [state, setState] = useState(editRow?.state ?? '')
  const [isIrrevocable, setIsIrrevocable] = useState(editRow?.is_irrevocable ?? false)
  const [excludesFromEstate, setExcludesFromEstate] = useState(
    editRow?.excludes_from_estate ?? (editRow != null && num(editRow.excluded_from_estate) > 0),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setIsSubmitting(true)
    try {
      const funding = Math.max(0, parseFloat(fundingAmount) || 0)
      const body = {
        name: name.trim() || 'Trust',
        trust_type: trustType,
        grantor: grantor.trim(),
        trustee: trustee.trim(),
        funding_amount: funding,
        state: state.trim(),
        is_irrevocable: isIrrevocable,
        excludes_from_estate: excludesFromEstate,
      }

      const res = await fetch('/api/consumer/trusts', {
        method: editRow ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editRow ? { id: editRow.id, ...body } : body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save trust')
      await onSaved(data as TrustRow)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200">
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="text-base font-semibold text-neutral-900">
            {editRow ? 'Edit Trust' : 'Add Trust'}
          </h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-600">X</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{formError}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Smith Family Trust" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Trust type</label>
            <select value={trustType} onChange={(e) => setTrustType(e.target.value)} className={inputClass}>
              {TRUST_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Grantor</label>
              <input type="text" value={grantor} onChange={(e) => setGrantor(e.target.value)} className={inputClass} placeholder="Name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Trustee</label>
              <input type="text" value={trustee} onChange={(e) => setTrustee(e.target.value)} className={inputClass} placeholder="Name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Funding amount ($)</label>
              <input type="number" min="0" step="0.01" value={fundingAmount} onChange={(e) => setFundingAmount(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">State</label>
              <input type="text" value={state} onChange={(e) => setState(e.target.value)} className={inputClass} placeholder="e.g. CA" maxLength={32} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input id="tw-isIrrevocable" type="checkbox" checked={isIrrevocable} onChange={(e) => setIsIrrevocable(e.target.checked)} className="h-4 w-4 rounded border-neutral-300" />
            <label htmlFor="tw-isIrrevocable" className="text-sm text-neutral-700">Is irrevocable</label>
          </div>
          <div className="flex items-center gap-2">
            <input id="tw-excludesFromEstate" type="checkbox" checked={excludesFromEstate} onChange={(e) => setExcludesFromEstate(e.target.checked)} className="h-4 w-4 rounded border-neutral-300" />
            <label htmlFor="tw-excludesFromEstate" className="text-sm text-neutral-700">Excludes from estate</label>
          </div>
          <div className="flex gap-3 pt-2 pb-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition">
              {isSubmitting ? 'Saving...' : editRow ? 'Save Changes' : 'Add Trust'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
