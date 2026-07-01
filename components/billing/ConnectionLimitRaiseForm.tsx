'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { ConnectionRaiseLimitPreview } from '@/lib/billing/connectionRaiseLimitPreview'

type Props = {
  raiseApiPath: string
  currentLimit: number
  connectedCount: number
  billingFloor: number
  buildPreview: (opts: {
    connectedCount: number
    billingFloor: number
    newLimit: number
  }) => ConnectionRaiseLimitPreview
  onSuccess: () => void
  onCancel?: () => void
  compact?: boolean
  submitLabel?: string
  nextClientHint?: string | null
}

export function ConnectionLimitRaiseForm({
  raiseApiPath,
  currentLimit,
  connectedCount,
  billingFloor,
  buildPreview,
  onSuccess,
  onCancel,
  compact = false,
  submitLabel = 'Confirm raise',
  nextClientHint,
}: Props) {
  const [raiseLimitInput, setRaiseLimitInput] = useState(currentLimit + 1)
  const [raisePreview, setRaisePreview] = useState<ConnectionRaiseLimitPreview | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRaiseLimitInput(currentLimit + 1)
  }, [currentLimit])

  useEffect(() => {
    if (raiseLimitInput <= currentLimit) {
      setRaisePreview(null)
      return
    }
    setRaisePreview(
      buildPreview({
        connectedCount,
        billingFloor,
        newLimit: raiseLimitInput,
      }),
    )
  }, [raiseLimitInput, currentLimit, connectedCount, billingFloor, buildPreview])

  const canSubmit = raiseLimitInput > currentLimit && !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(raiseApiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_client_limit: raiseLimitInput }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Raise failed.')
        return
      }
      onSuccess()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {!compact && (
        <p className="text-sm text-neutral-600">
          Add headroom before connecting more households. Your bill updates when you connect into the
          new capacity — no checkout.
        </p>
      )}
      {nextClientHint && (
        <p className="text-sm text-neutral-700">{nextClientHint}</p>
      )}
      <div>
        <label
          htmlFor="connection-raise-limit"
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          New client limit (current: {currentLimit})
        </label>
        <input
          id="connection-raise-limit"
          type="number"
          min={currentLimit + 1}
          max={250}
          value={raiseLimitInput}
          onChange={(e) => {
            const parsed = parseInt(e.target.value, 10)
            setRaiseLimitInput(Number.isNaN(parsed) ? currentLimit + 1 : parsed)
          }}
          className="w-full max-w-xs rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      {raisePreview && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
          <p>
            Est. monthly now: ${raisePreview.newMonthly.toLocaleString('en-US')}
            {raisePreview.rateImproved && (
              <span className="text-green-700">
                {' '}
                — lower per-client rate in the {raisePreview.newBandLabel} band
              </span>
            )}
          </p>
          <p className="mt-2 text-neutral-600">
            After you connect the next client: billable {raisePreview.nextBillableOnConnect} → about
            ${raisePreview.nextClientMonthlyCost.toLocaleString('en-US')}/mo (prorated on your existing
            subscription).
          </p>
        </div>
      )}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          loading={submitting}
          variant="primary"
          className="rounded-lg px-4 py-2.5 text-sm"
        >
          {submitting ? 'Saving…' : submitLabel}
        </Button>
        {onCancel && (
          <Button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            variant="outline"
            className="rounded-lg px-4 py-2.5 text-sm"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}
