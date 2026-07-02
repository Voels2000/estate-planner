'use client'

import { useCallback, useState } from 'react'
import { ConnectionLimitRaiseForm } from '@/components/billing/ConnectionLimitRaiseForm'
import { buildAttorneyRaiseLimitPreview } from '@/lib/billing/attorneyConnectionBillingSummary'
import {
  attorneyCheckoutGateCopy,
  consumerAttorneyBillingBlockedMessage,
  type AttorneyConnectBillingGatePayload,
} from '@/lib/billing/attorneyConnectBillingGateClient'

type LimitRaiseModalState = {
  currentLimit: number
  connected_count: number
  billing_floor: number
}

type Props = {
  checkoutModal: { quantity: number } | null
  limitRaiseModal: LimitRaiseModalState | null
  checkoutLoading: boolean
  onCloseCheckout: () => void
  onCloseRaise: () => void
  onConfirmCheckout: (quantity: number) => void | Promise<void>
  onRaiseSuccess: () => void
}

export function AttorneyConnectionBillingGateModals({
  checkoutModal,
  limitRaiseModal,
  checkoutLoading,
  onCloseCheckout,
  onCloseRaise,
  onConfirmCheckout,
  onRaiseSuccess,
}: Props) {
  const checkoutCopy = checkoutModal ? attorneyCheckoutGateCopy(checkoutModal.quantity) : null

  return (
    <>
      {checkoutModal && checkoutCopy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <div className="mb-1 text-2xl">💳</div>
            <h2 className="text-lg font-bold text-neutral-900">{checkoutCopy.title}</h2>
            <p className="mt-2 text-sm text-neutral-600">{checkoutCopy.body}</p>
            <p className="mt-2 text-xs text-neutral-500">1 client is always free on your listing.</p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void onConfirmCheckout(checkoutModal.quantity)}
                disabled={checkoutLoading}
                className="w-full rounded-lg bg-[color:var(--mwm-navy)] px-4 py-2.5 text-center text-sm font-medium text-white hover:opacity-90 transition disabled:opacity-60"
              >
                {checkoutLoading ? 'Redirecting…' : 'Continue to checkout →'}
              </button>
              <button
                type="button"
                onClick={onCloseCheckout}
                disabled={checkoutLoading}
                className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {limitRaiseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-1 text-2xl">📈</div>
            <h2 className="text-lg font-bold text-neutral-900">Client limit reached</h2>
            <p className="mt-2 text-sm text-neutral-600">
              You have {limitRaiseModal.connected_count} of {limitRaiseModal.currentLimit} clients at
              your limit (1 is always free). Raise your ceiling to connect more — no checkout.
            </p>
            <div className="mt-6">
              <ConnectionLimitRaiseForm
                compact
                raiseApiPath="/api/attorney/connection-limit/raise"
                currentLimit={limitRaiseModal.currentLimit}
                connectedCount={limitRaiseModal.connected_count}
                billingFloor={limitRaiseModal.billing_floor}
                buildPreview={buildAttorneyRaiseLimitPreview}
                onSuccess={onRaiseSuccess}
                onCancel={onCloseRaise}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function useAttorneyConnectionBillingGateHandlers() {
  const [checkoutModal, setCheckoutModal] = useState<{ quantity: number } | null>(null)
  const [limitRaiseModal, setLimitRaiseModal] = useState<LimitRaiseModalState | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  function handleConnectBillingError(
    data: {
      error?: string
      quantity?: number
      currentLimit?: number
      connected_count?: number
      billing_floor?: number
    },
    status: number,
  ): boolean {
    if (status === 402 && data.error === 'attorney_checkout_required' && typeof data.quantity === 'number') {
      setCheckoutModal({ quantity: data.quantity })
      return true
    }
    if (
      status === 402 &&
      data.error === 'limit_raise_required' &&
      typeof data.currentLimit === 'number'
    ) {
      setLimitRaiseModal({
        currentLimit: data.currentLimit,
        connected_count:
          typeof data.connected_count === 'number' ? data.connected_count : data.currentLimit,
        billing_floor: typeof data.billing_floor === 'number' ? data.billing_floor : 0,
      })
      return true
    }
    return false
  }

  async function startAttorneyConnectionCheckout(quantity: number): Promise<boolean> {
    setCheckoutLoading(true)
    try {
      const res = await fetch('/api/stripe/attorney-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return false
      }
      if (data.url && typeof data.url === 'string') {
        window.location.href = data.url
        return true
      }
      return false
    } finally {
      setCheckoutLoading(false)
    }
  }

  return {
    checkoutModal,
    setCheckoutModal,
    limitRaiseModal,
    setLimitRaiseModal,
    checkoutLoading,
    handleConnectBillingError,
    startAttorneyConnectionCheckout,
  }
}

export function ConsumerAttorneyBillingBlockedAlert({ message }: { message: string }) {
  return (
    <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
      {message}
    </p>
  )
}

/** Consumer paths: grant-access, invite-accept, intake-complete. */
export function useConsumerAttorneyBillingGateMessage() {
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null)

  const applyGateResponse = useCallback(
    (data: AttorneyConnectBillingGatePayload, status: number): boolean => {
      const message = consumerAttorneyBillingBlockedMessage(data, status)
      if (message) {
        setBlockedMessage(message)
        return true
      }
      return false
    },
    [],
  )

  return {
    blocked: blockedMessage != null,
    blockedMessage,
    applyGateResponse,
    clearBlocked: () => setBlockedMessage(null),
  }
}

export async function postAttorneyGrantAccess(body: {
  attorney_id: string
  intakeToken?: string
}): Promise<{ ok: true } | { ok: false; status: number; data: AttorneyConnectBillingGatePayload }> {
  const res = await fetch('/api/attorney/grant-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as AttorneyConnectBillingGatePayload
  if (!res.ok) {
    return { ok: false, status: res.status, data }
  }
  return { ok: true }
}

/** Consumer grant-access surface — surfaces billing gate copy instead of raw API errors. */
export function useConsumerGrantAttorneyAccess() {
  const gate = useConsumerAttorneyBillingGateMessage()

  async function grantAccess(body: {
    attorney_id: string
    intakeToken?: string
  }): Promise<{ ok: true } | { ok: false; blocked: true } | { ok: false; blocked: false; error: string }> {
    const result = await postAttorneyGrantAccess(body)
    if (result.ok) return { ok: true }
    if (gate.applyGateResponse(result.data, result.status)) {
      return { ok: false, blocked: true }
    }
    return {
      ok: false,
      blocked: false,
      error: typeof result.data.error === 'string' ? result.data.error : 'Unable to connect with attorney',
    }
  }

  return {
    ...gate,
    grantAccess,
  }
}
