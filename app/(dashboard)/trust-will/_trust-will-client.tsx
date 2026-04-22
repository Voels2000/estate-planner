'use client'
import { useState, useCallback, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CollapsibleSection } from '@/components/CollapsibleSection'

type Rec = { title: string; description: string; priority: 'high' | 'medium' | 'low' }
type CheckItem = { task: string; completed: boolean }

export type TrustRow = {
  id: string
  owner_id: string
  name: string
  excluded_from_estate?: unknown
  trust_type?: string
  grantor?: string | null
  trustee?: string | null
  funding_amount?: unknown
  state?: string | null
  is_irrevocable?: boolean
  excludes_from_estate?: boolean
  created_at?: string
  updated_at?: string
}

const TRUST_TYPES = [
  { value: 'revocable', label: 'Revocable' },
  { value: 'irrevocable', label: 'Irrevocable' },
  { value: 'qtip', label: 'QTIP' },
  { value: 'bypass', label: 'Bypass' },
  { value: 'charitable', label: 'Charitable' },
  { value: 'special_needs', label: 'Special needs' },
] as const

const priorityColors = {
  high: 'bg-red-50 border-red-200 text-red-700',
  medium: 'bg-amber-50 border-amber-200 text-amber-700',
  low: 'bg-blue-50 border-blue-200 text-blue-700',
}
const priorityLabels = {
  high: 'High Priority',
  medium: 'Medium Priority',
  low: 'Good to Have',
}

function num(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v !== '') return Number(v) || 0
  return 0
}

function formatDollars(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const inputClass =
  'block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500'

export default function TrustWillClient({
  estateValue,
  recommendations,
  checklist,
  initialTrusts = [],
}: {
  estateValue: number
  recommendations: Rec[]
  checklist: CheckItem[]
  initialTrusts?: TrustRow[]
}) {
  const router = useRouter()
  const [trusts, setTrusts] = useState<TrustRow[]>(initialTrusts)
  const [showTrustModal, setShowTrustModal] = useState(false)
  const [editTrust, setEditTrust] = useState<TrustRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadTrusts = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error: e } = await supabase
      .from('trusts')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    if (e) setError(e.message)
    else setTrusts((data as TrustRow[]) ?? [])
  }, [])

  function openAddTrust() { setEditTrust(null); setShowTrustModal(true); setError(null) }
  function openEditTrust(t: TrustRow) { setEditTrust(t); setShowTrustModal(true); setError(null) }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Trust & Will Guidance</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Personalized recommendations based on your estate profile. This is guidance only -
            please consult a qualified estate planning attorney before taking action.
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

      <CollapsibleSection
        title="Estimated Taxable Estate"
        defaultOpen={true}
        storageKey="trust-will-estimated-estate-value"
      >
        <p className="text-2xl font-bold text-neutral-900">
          ${estateValue.toLocaleString()}
        </p>
      </CollapsibleSection>

      <CollapsibleSection
        title="Trusts"
        subtitle={trusts.length > 0 ? `${trusts.length} trust${trusts.length === 1 ? '' : 's'} on file` : 'No trusts added yet'}
        defaultOpen={true}
        storageKey="trust-will-trusts"
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
                  {['Name', 'Type', 'Grantor', 'Trustee', 'Funding', 'Excludes from estate', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {trusts.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-50/80">
                    <td className="px-4 py-3 text-sm font-medium text-neutral-900">{t.name}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {TRUST_TYPES.find((x) => x.value === (t.trust_type || 'revocable'))?.label ?? t.trust_type}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{t.grantor || '-'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{t.trustee || '-'}</td>
                    <td className="px-4 py-3 text-sm tabular-nums text-neutral-900">
                      {formatDollars(num(t.funding_amount ?? t.excluded_from_estate))}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={t.excludes_from_estate || num(t.excluded_from_estate) > 0 ? 'text-green-700 font-medium' : 'text-neutral-400'}>
                        {t.excludes_from_estate || num(t.excluded_from_estate) > 0 ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEditTrust(t)}
                        className="text-sm font-medium text-neutral-700 hover:text-neutral-900"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Foundational Documents"
        defaultOpen={false}
        storageKey="trust-will-foundational-documents"
      >
        {recommendations.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No specific recommendations at this time. Ensure your basic will is up to date.
          </p>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div key={rec.title} className={`rounded-xl border px-5 py-4 ${priorityColors[rec.priority]}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-sm">{rec.title}</p>
                  <span className="text-xs font-medium opacity-70">{priorityLabels[rec.priority]}</span>
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
        storageKey="trust-will-action-checklist"
      >
        <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 -m-2">
          {checklist.map((item, i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-neutral-900"
                defaultChecked={item.completed}
              />
              <p className="text-sm text-neutral-700">{item.task}</p>
            </div>
          ))}
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
          onSaved={async () => {
            setShowTrustModal(false)
            setEditTrust(null)
            await loadTrusts()
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
  onSaved: () => Promise<void>
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
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const funding = Math.max(0, parseFloat(fundingAmount) || 0)
      const excludedNumeric = excludesFromEstate ? funding : 0

      const payload = {
        name: name.trim() || 'Trust',
        trust_type: trustType,
        grantor: grantor.trim(),
        trustee: trustee.trim(),
        funding_amount: funding,
        state: state.trim().length === 2 ? state.trim().toUpperCase() : state.trim(),
        is_irrevocable: isIrrevocable,
        excludes_from_estate: excludesFromEstate,
        excluded_from_estate: excludedNumeric,
        updated_at: new Date().toISOString(),
      }

      if (editRow) {
        const { error } = await supabase.from('trusts').update(payload).eq('id', editRow.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('trusts').insert({
          ...payload,
          owner_id: (await supabase.auth.getUser()).data.user?.id,
        })
        if (error) throw error
      }
      await onSaved()
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
