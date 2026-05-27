'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDollars } from '@/lib/utils/formatCurrency'
import {
  removeConsumerStrategyLineItem,
  saveConsumerStrategyLineItem,
} from '@/lib/consumer/consumerStrategyLineItems'

export type InsurancePolicyOption = {
  id: string
  label: string
  deathBenefit: number
  isIlit: boolean
}

export type IlitSavedRow = {
  amount: number
  metadata: Record<string, unknown> | null
}

type Props = {
  householdId: string
  ownerUserId: string
  savedRow: IlitSavedRow | null
  onSaved: () => void
  onRemoved: () => void
}

function policyLabel(row: {
  id: string
  description: string | null
  policy_type: string | null
  death_benefit: number | null
}): string {
  const type = row.policy_type ?? 'Life insurance'
  const desc = row.description?.trim()
  const benefit = Number(row.death_benefit ?? 0)
  const benefitStr = benefit > 0 ? formatDollars(benefit) : 'Amount TBD'
  return desc ? `${desc} (${type}) — ${benefitStr}` : `${type} — ${benefitStr}`
}

export function IlitStrategyForm({
  householdId,
  ownerUserId,
  savedRow,
  onSaved,
  onRemoved,
}: Props) {
  const [policies, setPolicies] = useState<InsurancePolicyOption[]>([])
  const [loadingPolicies, setLoadingPolicies] = useState(true)
  const [editing, setEditing] = useState(!savedRow)
  const [selectedPolicyId, setSelectedPolicyId] = useState('')
  const [manualAmount, setManualAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    setLoadingPolicies(true)
    supabase
      .from('insurance_policies')
      .select('id, description, policy_type, death_benefit, is_ilit')
      .eq('user_id', ownerUserId)
      .order('description', { ascending: true })
      .then(({ data, error: loadError }) => {
        if (cancelled) return
        if (loadError) {
          console.error('[IlitStrategyForm] insurance load', loadError.message)
          setPolicies([])
        } else {
          setPolicies(
            (data ?? []).map((row) => ({
              id: row.id as string,
              label: policyLabel({
                id: row.id as string,
                description: row.description as string | null,
                policy_type: row.policy_type as string | null,
                death_benefit: row.death_benefit as number | null,
              }),
              deathBenefit: Number(row.death_benefit ?? 0),
              isIlit: Boolean(row.is_ilit),
            })),
          )
        }
        setLoadingPolicies(false)
      })
    return () => {
      cancelled = true
    }
  }, [ownerUserId])

  const hasPolicies = policies.length > 0

  const selectedPolicy = useMemo(
    () => policies.find((p) => p.id === selectedPolicyId) ?? null,
    [policies, selectedPolicyId],
  )

  useEffect(() => {
    if (!savedRow) {
      setEditing(true)
      return
    }
    if (editing) {
      const meta = savedRow.metadata ?? {}
      setSelectedPolicyId(typeof meta.policy_id === 'string' ? meta.policy_id : '')
      setManualAmount(String(Math.round(savedRow.amount)))
      setNotes(typeof meta.notes === 'string' ? meta.notes : '')
    }
  }, [savedRow, editing])

  async function handleSave() {
    let amount = 0
    let metadata: Record<string, unknown> = { notes: notes.trim() || undefined }

    if (hasPolicies && selectedPolicy) {
      amount = Math.round(selectedPolicy.deathBenefit)
      if (amount <= 0) {
        setError('Selected policy has no death benefit amount on file.')
        return
      }
      metadata = {
        ...metadata,
        policy_id: selectedPolicy.id,
        policy_label: selectedPolicy.label,
      }
    } else {
      const parsed = Number(manualAmount)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError('Enter a coverage amount greater than zero.')
        return
      }
      amount = Math.round(parsed)
      metadata = { ...metadata, manual_entry: true }
    }

    setError(null)
    setSaving(true)
    try {
      await saveConsumerStrategyLineItem(householdId, {
        strategy_source: 'ilit',
        category: 'trust_exclusion',
        amount,
        confidence_level: 'illustrative',
        metadata,
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
      await removeConsumerStrategyLineItem(householdId, 'ilit')
      setSelectedPolicyId('')
      setManualAmount('')
      setNotes('')
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
    const policyLabelText =
      typeof meta.policy_label === 'string'
        ? meta.policy_label
        : typeof meta.policy_id === 'string'
          ? 'Selected policy'
          : null

    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <p className="font-semibold">ILIT funded: {formatDollars(savedRow.amount)}</p>
          {policyLabelText && <p className="mt-1 text-green-800">{policyLabelText}</p>}
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

      {loadingPolicies ? (
        <p className="text-sm text-gray-500">Loading insurance policies…</p>
      ) : hasPolicies ? (
        <>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Insurance policy</label>
            <select
              value={selectedPolicyId}
              onChange={(e) => setSelectedPolicyId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Select a policy…</option>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.isIlit ? ' (already ILIT)' : ''}
                </option>
              ))}
            </select>
          </div>
          {selectedPolicy && selectedPolicy.deathBenefit > 0 && (
            <p className="text-xs text-gray-600 mt-1">
              Death benefit to model: {formatDollars(selectedPolicy.deathBenefit)}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Add your policies in the{' '}
            <Link href="/insurance" className="font-medium underline">
              Insurance
            </Link>{' '}
            section for more accurate modeling.
          </p>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Coverage amount</label>
            <input
              type="number"
              min={0}
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="500000"
            />
          </div>
        </>
      )}

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
          disabled={saving || (hasPolicies && !selectedPolicyId)}
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
