'use client'

import { useState } from 'react'

export type ReversalModalAction = 'return_to_sandbox' | 'withdraw' | 'demote'

const ACTION_COPY: Record<
  ReversalModalAction,
  {
    title: string
    description: string
    confirmLabel: string
    showReason: boolean
    confirmStyle: string
  }
> = {
  return_to_sandbox: {
    title: 'Return to sandbox?',
    description:
      'This strategy will move back to your sandbox. It will no longer reduce your taxable estate until you add it to your plan again.',
    confirmLabel: 'Return to sandbox',
    showReason: false,
    confirmStyle: 'bg-[color:var(--mwm-navy)] hover:bg-[color:var(--mwm-navy)]/90',
  },
  withdraw: {
    title: 'Withdraw this strategy?',
    description:
      'This strategy will be removed from your plan and will no longer affect your estate calculations. The record will be preserved in your history.',
    confirmLabel: 'Withdraw strategy',
    showReason: true,
    confirmStyle: 'bg-red-600 hover:bg-red-700',
  },
  demote: {
    title: 'Unwind this executed strategy?',
    description:
      'This strategy was marked as executed. Moving it back to "In My Plan" reflects that the transfer has not yet been completed.',
    confirmLabel: 'Move back to plan',
    showReason: true,
    confirmStyle: 'bg-amber-600 hover:bg-amber-700',
  },
}

type ReversalModalProps = {
  strategyName: string
  action: ReversalModalAction
  onConfirm: (reason: string | undefined) => Promise<void>
  onCancel: () => void
}

export function ReversalModal({
  strategyName,
  action,
  onConfirm,
  onCancel,
}: ReversalModalProps) {
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const copy = ACTION_COPY[action]

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      await onConfirm(copy.showReason && reason.trim() ? reason.trim() : undefined)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-base font-semibold text-[color:var(--mwm-navy)]">{copy.title}</h2>
        <p className="mb-3 text-sm font-medium text-gray-600">{strategyName}</p>
        <p className="mb-4 text-sm text-gray-500">{copy.description}</p>

        {copy.showReason && (
          <div className="mb-4">
            <label className="mb-1 block text-xs font-semibold text-gray-700">Reason (optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Attorney advised against this approach"
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[color:var(--mwm-navy)] focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              This will be visible to your connected advisor.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={confirming}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50 ${copy.confirmStyle}`}
          >
            {confirming ? 'Processing…' : copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
