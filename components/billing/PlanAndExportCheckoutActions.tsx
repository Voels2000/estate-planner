'use client'

import { BILLING_DISCLOSURES } from '@/lib/compliance/billing-disclosures'
import { planAndExportAmountCents } from '@/lib/billing/oneTimePurchases'
import { Button } from '@/components/ui/Button'
import { PlanAndExportRefundAckCheckbox } from '@/components/billing/PlanAndExportRefundAckCheckbox'
import { usePlanAndExportCheckout } from '@/components/billing/usePlanAndExportCheckout'

type Props = {
  returnTo?: string
  buttonClassName?: string
  buttonFullWidth?: boolean
}

/** Shared Plan & Export buy surface: disclosure + refund ack checkbox + gated CTA. */
export function PlanAndExportCheckoutActions({
  returnTo = '/print',
  buttonClassName = 'w-full rounded-lg py-2.5 text-sm font-medium sm:w-auto',
  buttonFullWidth = false,
}: Props) {
  const priceCents = planAndExportAmountCents()
  const priceDisplay = `$${(priceCents / 100).toLocaleString('en-US')}`
  const disclosure = BILLING_DISCLOSURES.planAndExportCheckout(priceDisplay)

  const {
    loading,
    error,
    refundAckAccepted,
    refundAckError,
    onRefundAckChange,
    handleBuy,
    canCheckout,
  } = usePlanAndExportCheckout(returnTo)

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-neutral-600">{disclosure}</p>
      <PlanAndExportRefundAckCheckbox
        checked={refundAckAccepted}
        onChange={onRefundAckChange}
        showError={refundAckError}
      />
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="primary"
        disabled={!canCheckout}
        onClick={() => void handleBuy()}
        className={buttonFullWidth ? `w-full ${buttonClassName}` : buttonClassName}
      >
        {loading ? 'Redirecting…' : `Buy Plan & Export — ${priceDisplay}`}
      </Button>
    </div>
  )
}
