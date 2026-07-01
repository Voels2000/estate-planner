'use client'

import { useCallback, useState } from 'react'
import {
  attorneyCheckoutGateCopy,
  consumerAttorneyBillingBlockedMessage,
  type AttorneyConnectBillingGatePayload,
} from '@/lib/billing/attorneyConnectBillingGateClient'

type Props = {
  checkoutModal: { quantity: number } | null
  limitRaiseModal: { currentLimit: number; connected_count: number } | null
  checkoutLoading: boolean
  onCloseCheckout: () => void
  onCloseRaise: () => void
  onConfirmCheckout: (quantity: number) => void | Promise<void>
  onConfirmRaise: () => void
}

export function AttorneyConnectionBillingGateModals({
  checkoutModal,
  limitRaiseModal,
  checkoutLoading,
  onCloseCheckout,
  onCloseRaise,
  onConfirmCheckout,
  onConfirmRaise,
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
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <div className="mb-1 text-2xl">📈</div>
            <h2 className="text-lg font-bold text-neutral-900">Client limit reached</h2>
            <p className="mt-2 text-sm text-neutral-600">
              You have {limitRaiseModal.connected_count} of {limitRaiseModal.currentLimit} connected
              households at your limit. Raise your client limit to connect more.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <a
                href="/attorney/billing?action=raise"
                onClick={onConfirmRaise}
                className="w-full rounded-lg bg-[color:var(--mwm-navy)] px-4 py-2.5 text-center text-sm font-medium text-white hover:opacity-90 transition"
              >
                Raise limit →
              </a>
              <button
                type="button"
                onClick={onCloseRaise}
                className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function useAttorneyConnectionBillingGateHandlers() {
  const [checkoutModal, setCheckoutModal] = useState<{ quantity: number } | null>(null)
  const [limitRaiseModal, setLimitRaiseModal] = useState<{
    currentLimit: number
    connected_count: number
  } | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  function handleConnectBillingError(
    data: { error?: string; quantity?: number; currentLimit?: number; connected_count?: number },
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
