'use client'

import { useState } from 'react'

type CheckoutResult = { url?: string; error?: string; code?: string }

export function usePlanAndExportCheckout(returnTo = '/print') {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refundAckAccepted, setRefundAckAccepted] = useState(false)
  const [refundAckError, setRefundAckError] = useState(false)

  async function handleBuy() {
    setError(null)
    if (!refundAckAccepted) {
      setRefundAckError(true)
      return
    }
    setRefundAckError(false)
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: 'plan_and_export',
          returnTo,
          refundAckAccepted: true,
        }),
      })
      const data = (await res.json()) as CheckoutResult
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Checkout failed. Please try again.')
        setLoading(false)
        return
      }
      window.location.assign(data.url)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  function onRefundAckChange(checked: boolean) {
    setRefundAckAccepted(checked)
    if (checked) setRefundAckError(false)
  }

  return {
    loading,
    error,
    refundAckAccepted,
    refundAckError,
    onRefundAckChange,
    handleBuy,
    canCheckout: refundAckAccepted && !loading,
  }
}
