'use client'

import { useState } from 'react'
import { PLAN_EXPORT_REFUND_ACK_CHECKBOX_LABEL } from '@/lib/legal/plan-export-refund-policy'

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  showError?: boolean
  id?: string
}

export function PlanAndExportRefundAckCheckbox({
  checked,
  onChange,
  showError = false,
  id = 'plan-export-refund-ack',
}: Props) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          data-testid="plan-export-refund-ack-checkbox"
          className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded border-neutral-300 accent-[color:var(--mwm-navy)]"
        />
        <span className="text-sm leading-relaxed text-neutral-700">
          {PLAN_EXPORT_REFUND_ACK_CHECKBOX_LABEL}
        </span>
      </label>
      {showError && (
        <p className="ml-7 text-xs text-red-600" data-testid="plan-export-refund-ack-error">
          Acknowledge the refund policy to continue.
        </p>
      )}
    </div>
  )
}
