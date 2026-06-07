'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import {
  sumAdjustedTaxableGifts,
  type AdjustedTaxableGiftRow,
} from '@/lib/gifting/adjustedTaxableGifts'

const fmt$ = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const ATG_EXPLAINER =
  'Post-1976 taxable gifts that are added back to your taxable estate under IRC §2001(b). ' +
  'This is separate from lifetime exemption gifts logged on Form 709 — it affects estate tax composition, not annual gifting capacity.'

const emptyForm = () => ({
  gift_year: new Date().getFullYear() - 1,
  amount: '',
  recipient_description: '',
  three_year_clawback: false,
  notes: '',
})

async function parseApiError(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const data = JSON.parse(text) as { error?: string }
    if (data.error) return data.error
  } catch {
    // ignore
  }
  return text || 'Request failed'
}

export function AdjustedTaxableGiftsSection() {
  const router = useRouter()
  const [rows, setRows] = useState<AdjustedTaxableGiftRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/consumer/adjusted-taxable-gifts')
      if (!res.ok) throw new Error(await parseApiError(res))
      const data = (await res.json()) as { rows?: AdjustedTaxableGiftRow[] }
      setRows(data.rows ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to load adjusted taxable gifts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const refreshAfterWrite = () => {
    router.refresh()
    void load()
  }

  const handleAdd = async () => {
    if (!form.amount) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/consumer/adjusted-taxable-gifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gift_year: form.gift_year,
          amount: parseFloat(form.amount),
          recipient_description: form.recipient_description.trim() || null,
          three_year_clawback: form.three_year_clawback,
          notes: form.notes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error(await parseApiError(res))
      setForm(emptyForm())
      setShowForm(false)
      refreshAfterWrite()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleteId(id)
    setError(null)
    try {
      const res = await fetch('/api/consumer/adjusted-taxable-gifts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error(await parseApiError(res))
      refreshAfterWrite()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to delete')
    } finally {
      setDeleteId(null)
    }
  }

  const total = sumAdjustedTaxableGifts(rows)

  return (
    <CollapsibleSection
      title="Adjusted taxable gifts (IRC §2001(b))"
      subtitle="Post-1976 taxable gifts added back to taxable estate"
      defaultOpen={rows.length > 0}
      storageKey="gifting-adjusted-taxable-gifts"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 inline-flex items-start gap-1">
          <span>
            Record taxable gifts that increase your taxable estate at death under §2001(b). Distinct from
            prior Form 709 lifetime exemption gifts above.
          </span>
          <InfoTooltip content={ATG_EXPLAINER} size="sm" />
        </p>

        {!loading && total > 0 && (
          <p className="text-sm font-medium text-gray-900">
            Total ATG add-back: <span className="text-[color:var(--mwm-navy)]">{fmt$(total)}</span>
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            These amounts flow into estate composition on trust strategy and estate tax pages.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(v => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {showForm ? 'Cancel' : 'Add ATG entry'}
          </button>
        </div>

        {showForm && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Gift year *</label>
                <input
                  type="number"
                  value={form.gift_year}
                  onChange={e =>
                    setForm(f => ({ ...f, gift_year: parseInt(e.target.value, 10) || f.gift_year }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Amount *</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Recipient / description</label>
              <input
                type="text"
                value={form.recipient_description}
                onChange={e => setForm(f => ({ ...f, recipient_description: e.target.value }))}
                placeholder="e.g. Family trust, Child"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="atg-clawback"
                checked={form.three_year_clawback}
                onChange={e => setForm(f => ({ ...f, three_year_clawback: e.target.checked }))}
                className="mt-0.5 rounded border-gray-300"
              />
              <label htmlFor="atg-clawback" className="text-sm text-gray-700">
                Three-year clawback (gift within 3 years of death)
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleAdd()}
                disabled={saving || !form.amount}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save entry'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">No adjusted taxable gifts recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map(row => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <p className="text-sm text-gray-800">
                  <span className="font-semibold">{fmt$(row.amount)}</span>
                  {' · '}
                  {row.gift_year}
                  {row.recipient_description ? ` · ${row.recipient_description}` : ''}
                  {row.three_year_clawback ? ' · 3-yr clawback' : ''}
                </p>
                <button
                  type="button"
                  onClick={() => void handleDelete(row.id)}
                  disabled={deleteId === row.id}
                  className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50 shrink-0"
                >
                  {deleteId === row.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}
