'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AttorneyUpgradePrompt } from '@/components/attorney/AttorneyUpgradePrompt'
import {
  AttorneyConnectionBillingGateModals,
  useAttorneyConnectionBillingGateHandlers,
} from '@/components/attorney/AttorneyConnectionBillingGateModals'

type IncomingRequest = {
  id: string
  household_id: string
  request_message: string | null
  created_at: string
  full_name: string
  email: string
  state: string
}

type IntakeRequest = {
  id: string
  client_email: string
  client_name: string | null
  displayStatus: 'sent' | 'opened'
  sent_at: string
}

export function AttorneyRequestsClient({
  incomingRequests: initialIncoming,
  intakeRequests,
  showClaimedBanner,
  hasListing,
}: {
  incomingRequests: IncomingRequest[]
  intakeRequests: IntakeRequest[]
  showClaimedBanner: boolean
  hasListing: boolean
}) {
  const router = useRouter()
  const [incoming, setIncoming] = useState(initialIncoming)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [capError, setCapError] = useState(false)
  const {
    checkoutModal,
    setCheckoutModal,
    limitRaiseModal,
    setLimitRaiseModal,
    checkoutLoading,
    handleConnectBillingError,
    startAttorneyConnectionCheckout,
  } = useAttorneyConnectionBillingGateHandlers()

  async function handleAccept(id: string) {
    setLoadingId(id)
    setError(null)
    setCapError(false)
    try {
      const res = await fetch('/api/attorney/accept-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attorney_client_id: id }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403) setCapError(true)
        if (handleConnectBillingError(data, res.status)) return
        throw new Error(data.error ?? 'Unable to accept')
      }
      setIncoming((prev) => prev.filter((r) => r.id !== id))
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to accept')
    } finally {
      setLoadingId(null)
    }
  }

  async function handleDecline(id: string) {
    if (!confirm('Decline this connection request?')) return
    setLoadingId(id)
    setError(null)
    try {
      const res = await fetch('/api/attorney/decline-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attorney_client_id: id }),
      })
      if (!res.ok) throw new Error('Unable to decline')
      setIncoming((prev) => prev.filter((r) => r.id !== id))
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to decline')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <AttorneyConnectionBillingGateModals
        checkoutModal={checkoutModal}
        limitRaiseModal={limitRaiseModal}
        checkoutLoading={checkoutLoading}
        onCloseCheckout={() => setCheckoutModal(null)}
        onCloseRaise={() => setLimitRaiseModal(null)}
        onConfirmCheckout={(quantity) => {
          void startAttorneyConnectionCheckout(quantity)
        }}
        onRaiseSuccess={() => {
          setLimitRaiseModal(null)
          router.refresh()
        }}
      />
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--mwm-navy)]">Requests</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Connection requests and open intake invitations. Accepting grants read-only access to client
          estate data — clients retain ownership and can revoke anytime.
        </p>
      </div>

      {showClaimedBanner && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Listing claimed successfully. Review any pending connection requests below.
        </div>
      )}

      {!hasListing && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Complete your{' '}
          <Link href="/attorney-directory/register" className="font-medium underline">
            directory listing
          </Link>{' '}
          to receive connection requests.
        </div>
      )}

      {capError && <AttorneyUpgradePrompt feature="client_cap" />}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Connection requests ({incoming.length})
        </h2>
        {incoming.length === 0 ? (
          <p className="text-sm text-neutral-500">No pending connection requests.</p>
        ) : (
          incoming.map((req) => (
            <div
              key={req.id}
              className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3"
            >
              <div>
                <p className="font-semibold text-neutral-900">{req.full_name}</p>
                <p className="text-sm text-neutral-600">
                  {req.email}
                  {req.state ? ` · ${req.state}` : ''}
                </p>
                {req.request_message && (
                  <p className="mt-2 text-sm text-neutral-700 italic border-l-2 border-amber-300 pl-3">
                    &ldquo;{req.request_message}&rdquo;
                  </p>
                )}
                <p className="text-xs text-neutral-400 mt-1">
                  Requested {new Date(req.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={loadingId === req.id}
                  onClick={() => void handleAccept(req.id)}
                  className="rounded-lg bg-[color:var(--mwm-navy)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
                >
                  {loadingId === req.id ? 'Accepting…' : 'Accept'}
                </button>
                <button
                  type="button"
                  disabled={loadingId === req.id}
                  onClick={() => void handleDecline(req.id)}
                  className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Open intake invitations ({intakeRequests.length})
        </h2>
        {intakeRequests.length === 0 ? (
          <p className="text-sm text-neutral-500">No open intake invitations.</p>
        ) : (
          intakeRequests.map((req) => (
            <div key={req.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="font-medium text-neutral-900">
                {req.client_name?.trim() || req.client_email}
              </p>
              <p className="text-sm text-neutral-600">{req.client_email}</p>
              <p className="text-xs text-neutral-400 mt-1 capitalize">
                {req.displayStatus} · Sent {new Date(req.sent_at).toLocaleDateString()}
              </p>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
