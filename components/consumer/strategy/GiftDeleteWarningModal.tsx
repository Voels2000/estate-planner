'use client'

import { formatDollars } from '@/lib/utils/formatCurrency'

export type GiftDeleteChoice = 'delete_only' | 'delete_and_withdraw' | 'cancel'

type GiftDeleteWarningModalProps = {
  giftAmount: number
  planAmount: number
  onChoice: (choice: GiftDeleteChoice) => void
}

export function GiftDeleteWarningModal({
  giftAmount,
  planAmount,
  onChoice,
}: GiftDeleteWarningModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-base font-semibold text-[color:var(--mwm-navy)]">
          This gift is part of your estate plan
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          Your Annual Gifting Program ({formatDollars(planAmount)} outside your estate) was saved
          based on your gift log ({formatDollars(giftAmount)}). Deleting this gift will not
          automatically update your estate plan.
        </p>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onChoice('delete_and_withdraw')}
            className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm transition-colors hover:bg-red-100"
          >
            <p className="font-medium text-red-700">Delete gift and remove from estate plan</p>
            <p className="mt-0.5 text-xs text-red-500">
              The {formatDollars(planAmount)} outside-estate reduction will be removed
            </p>
          </button>

          <button
            type="button"
            onClick={() => onChoice('delete_only')}
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left text-sm transition-colors hover:bg-gray-50"
          >
            <p className="font-medium text-gray-700">Delete gift only — keep in estate plan</p>
            <p className="mt-0.5 text-xs text-gray-400">
              The plan will show a drift warning until you update it
            </p>
          </button>

          <button
            type="button"
            onClick={() => onChoice('cancel')}
            className="w-full py-2 text-sm text-gray-400 transition-colors hover:text-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
