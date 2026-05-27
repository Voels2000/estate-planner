'use client'

import { useEffect, useState } from 'react'
import { formatDollars } from '@/lib/utils/formatCurrency'
import {
  removeConsumerStrategyLineItem,
  saveConsumerStrategyLineItem,
} from '@/lib/consumer/consumerStrategyLineItems'
import type { StrategyLineItemSource } from '@/lib/estate/types'

const STRATEGY_TYPES = [
  { value: 'daf' as const, label: 'Donor-Advised Fund' },
  { value: 'charitable' as const, label: 'Direct Charitable Gift' },
] as const

type CharitableSource = 'daf' | 'charitable'

export type CharitableSavedRow = {
  amount: number
  strategySource: CharitableSource
  metadata: Record<string, unknown> | null
}

type Props = {
  householdId: string
  savedRow: CharitableSavedRow | null
  onSaved: () => void
  onRemoved: () => void
}

function strategyLabel(source: CharitableSource): string {
  return STRATEGY_TYPES.find((t) => t.value === source)?.label ?? source
}

export function CharitableStrategyForm({
  householdId,
  savedRow,
  onSaved,
  onRemoved,
}: Props) {
  const [editing, setEditing] = useState(!savedRow)
  const [strategyType, setStrategyType] = useState<CharitableSource>('daf')
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!savedRow) {
      setEditing(true)
      return
    }
    if (editing) {
      setStrategyType(savedRow.strategySource)
      setAmount(String(Math.round(savedRow.amount)))
      const meta = savedRow.metadata ?? {}
      setRecipient(typeof meta.recipient === 'string' ? meta.recipient : '')
      setNotes(typeof meta.notes === 'string' ? meta.notes : '')
    }
  }, [savedRow, editing])

  async function handleSave() {
    const parsed = Number(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter an annual amount greater than zero.')
      return
    }

    setError(null)
    setSaving(true)
    try {
      if (savedRow && savedRow.strategySource !== strategyType) {
        await removeConsumerStrategyLineItem(householdId, savedRow.strategySource)
      }

      await saveConsumerStrategyLineItem(householdId, {
        strategy_source: strategyType as StrategyLineItemSource,
        category: 'charitable',
        amount: Math.round(parsed),
        confidence_level: 'illustrative',
        metadata: {
          recipient: recipient.trim() || undefined,
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
    if (!savedRow) return
    setSaving(true)
    setError(null)
    try {
      await removeConsumerStrategyLineItem(householdId, savedRow.strategySource)
      setAmount('')
      setRecipient('')
      setNotes('')
      setStrategyType('daf')
      setEditing(true)
      onRemoved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setSaving(false)
    }
  }

  if (savedRow && !editing) {
    const meta = savedRow.metadata ?? {}
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <p className="font-semibold">
            Charitable giving: {formatDollars(savedRow.amount)}/yr
          </p>
          <p className="mt-1 text-green-800">{strategyLabel(savedRow.strategySource)}</p>
          {typeof meta.recipient === 'string' && meta.recipient && (
            <p className="mt-1 text-green-800">Recipient/Fund: {meta.recipient}</p>
          )}
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
          <label className="text-xs text-gray-500 block mb-1">Strategy type</label>
          <select
            value={strategyType}
            onChange={(e) => setStrategyType(e.target.value as CharitableSource)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            {STRATEGY_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Annual amount</label>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="25000"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Recipient/Fund (optional)</label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Community Foundation DAF"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
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
