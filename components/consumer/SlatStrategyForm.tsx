'use client'

import { useEffect, useState } from 'react'
import { formatDollars } from '@/lib/utils/formatCurrency'
import {
  removeConsumerStrategyLineItem,
  saveConsumerStrategyLineItem,
} from '@/lib/consumer/consumerStrategyLineItems'

const FUNDING_SOURCES = [
  { value: 'financial_assets', label: 'Financial assets' },
  { value: 'real_estate', label: 'Real estate' },
  { value: 'business_interest', label: 'Business interest' },
] as const

export type SlatSavedRow = {
  amount: number
  metadata: Record<string, unknown> | null
}

type Props = {
  householdId: string
  disabled: boolean
  disabledReason?: string
  savedRow: SlatSavedRow | null
  onSaved: () => void
  onRemoved: () => void
}

export function SlatStrategyForm({
  householdId,
  disabled,
  disabledReason,
  savedRow,
  onSaved,
  onRemoved,
}: Props) {
  const [editing, setEditing] = useState(!savedRow)
  const [amount, setAmount] = useState('')
  const [fundingSource, setFundingSource] = useState<string>('financial_assets')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!savedRow) {
      setEditing(true)
      return
    }
    if (editing) {
      setAmount(String(Math.round(savedRow.amount)))
      const meta = savedRow.metadata ?? {}
      setFundingSource(
        typeof meta.funding_source === 'string' ? meta.funding_source : 'financial_assets',
      )
      setNotes(typeof meta.notes === 'string' ? meta.notes : '')
    }
  }, [savedRow, editing])

  async function handleSave() {
    const parsed = Number(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter a contribution amount greater than zero.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await saveConsumerStrategyLineItem(householdId, {
        strategy_source: 'slat',
        category: 'trust_exclusion',
        amount: Math.round(parsed),
        metadata: {
          funding_source: fundingSource,
          notes: notes.trim() || undefined,
        },
      })
      setEditing(false)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setSaving(true)
    setError(null)
    try {
      await removeConsumerStrategyLineItem(householdId, 'slat')
      setAmount('')
      setNotes('')
      setEditing(true)
      onRemoved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setSaving(false)
    }
  }

  if (disabled) {
    return (
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        {disabledReason ?? 'SLAT is available for married couples filing jointly only.'}
      </p>
    )
  }

  if (savedRow && !editing) {
    const meta = savedRow.metadata ?? {}
    const sourceLabel =
      FUNDING_SOURCES.find((s) => s.value === meta.funding_source)?.label ??
      (typeof meta.funding_source === 'string' ? String(meta.funding_source) : null)

    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <p className="font-semibold">SLAT funded: {formatDollars(savedRow.amount)}</p>
          {sourceLabel && <p className="mt-1 text-green-800">Funding source: {sourceLabel}</p>}
          {typeof meta.notes === 'string' && meta.notes && (
            <p className="mt-1 text-green-800">{meta.notes}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => void handleRemove()}
            disabled={saving}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-200 text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
          >
            Remove from plan
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-800">Model this strategy</h4>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Contribution amount</label>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="500000"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Funding source</label>
          <select
            value={fundingSource}
            onChange={(e) => setFundingSource(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            {FUNDING_SOURCES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Optional context for your advisor"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save to my plan'}
        </button>
        {savedRow && (
          <button
            type="button"
            onClick={() => {
              setEditing(false)
              setError(null)
            }}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
