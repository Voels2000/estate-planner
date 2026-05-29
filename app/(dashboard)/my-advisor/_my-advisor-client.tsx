'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { InviteAdvisorByEmailForm } from '@/components/consumer/InviteAdvisorByEmailForm'

type Connection = {
  id: string
  status: string
  accepted_at: string
  advisor_id: string
  profiles: {
    id: string
    full_name: string
    email: string
  } | null
} | null

type Listing = {
  firm_name: string | null
  city: string | null
  state: string | null
  bio: string | null
  credentials: string[]
  specializations: string[]
  is_fiduciary: boolean
  website: string | null
} | null

type AccessEntry = {
  accessed_at: string
  page: string
}

type PendingRequest = {
  id: string
  created_at: string
  firm_name: string | null
  city: string | null
  state: string | null
} | null

type OutboundInvite = {
  id: string
  invited_email: string | null
  created_at: string
  advisor_name: string | null
} | null

type Props = {
  connection: Connection
  wizardComplete: boolean
  listing: Listing
  accessLog: AccessEntry[]
  pendingRequest: PendingRequest
  outboundInvite: OutboundInvite
  consumerName: string
}

export default function MyAdvisorClient({
  connection,
  wizardComplete,
  listing,
  accessLog,
  pendingRequest,
  outboundInvite,
  consumerName,
}: Props) {
  const router = useRouter()
  const [isRevoking, setIsRevoking] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRevoke() {
    if (!connection) return
    const confirmed = window.confirm(
      'Are you sure you want to disconnect your advisor? They will no longer have access to your plan.'
    )
    if (!confirmed) return

    setIsRevoking(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('advisor_clients')
      .update({ status: 'revoked' })
      .eq('id', connection.id)

    if (err) {
      setError('Failed to disconnect advisor. Please try again.')
      setIsRevoking(false)
      return
    }

    router.refresh()
  }

  async function handleCancel(requestId: string) {
    if (!window.confirm('Cancel your connection request?')) return
    setCancelling(true)
    setError(null)
    try {
      const res = await fetch('/api/connection-requests/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId }),
      })
      if (res.ok) {
        setError(null)
        setCancelled(true)
        router.refresh()
      } else {
        const d = await res.json()
        setError(d.error ?? 'Failed to cancel request.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setCancelling(false)
    }
  }

  const showOnboardingAdvisorNote =
    !connection && !wizardComplete && !pendingRequest

  if (!connection) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--mwm-navy)]">My Advisor</h1>
          <p className="mt-1 text-sm text-neutral-500">Manage your advisor connection</p>
        </div>

        {showOnboardingAdvisorNote && (
          <div className="rounded-[var(--mwm-radius)] border border-[color:var(--mwm-gold)] bg-[var(--mwm-gold-pale)] px-5 py-4">
            <p className="text-sm font-medium text-[color:var(--mwm-navy)] mb-1">
              Planning works better with your advisor in the loop.
            </p>
            <p className="text-sm text-[color:var(--mwm-text-secondary)]">
              Invite your advisor to review your plan and collaborate on strategies. They can
              propose recommendations you accept or reject — all without sharing login credentials.
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {pendingRequest && !cancelled ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-4">
              <div style={{ fontSize: 28, flexShrink: 0 }}>⏳</div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-amber-800 mb-1">
                  Connection Request Pending
                </div>
                <div className="text-sm text-amber-700 mb-1">
                  {pendingRequest.firm_name
                    ? <>Your request to <strong>{pendingRequest.firm_name}</strong>
                      {(pendingRequest.city || pendingRequest.state) && (
                        <> ({[pendingRequest.city, pendingRequest.state].filter(Boolean).join(', ')})</>
                      )} is awaiting their response.</>
                    : 'Your connection request is awaiting a response from the advisor.'}
                </div>
                <div className="text-xs text-amber-600">
                  Sent {new Date(pendingRequest.created_at).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric'
                  })}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-amber-200 flex items-center justify-between flex-wrap gap-3">
              <div className="text-sm text-amber-700">
                Once accepted, your advisor will appear here.{' '}
                <Link href="/find-advisor" className="underline font-medium">
                  Browse other advisors
                </Link>
              </div>
              <button
                onClick={() => handleCancel(pendingRequest.id)}
                disabled={cancelling}
                className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Request'}
              </button>
            </div>
          </div>
        ) : outboundInvite ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <div className="text-sm font-semibold text-amber-800 mb-1">Connection Request Pending</div>
            <p className="text-sm text-amber-700">
              {outboundInvite.advisor_name ? (
                <>
                  Your request to connect with <strong>{outboundInvite.advisor_name}</strong> is
                  awaiting their response.
                </>
              ) : (
                <>
                  We emailed <strong>{outboundInvite.invited_email}</strong> an invitation to join
                  and connect on My Wealth Maps.
                </>
              )}
            </p>
            <p className="mt-2 text-xs text-amber-600">
              Sent{' '}
              {new Date(outboundInvite.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[color:var(--mwm-border)] bg-[var(--mwm-gold-pale)] p-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">✉️</span>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-[color:var(--mwm-navy)]">
                    Invite your advisor
                  </h2>
                  <p className="mt-1 text-sm text-[color:var(--mwm-navy)] leading-relaxed">
                    Already working with a financial advisor? Send them a secure invitation to join
                    My Wealth Maps and connect to your plan.
                  </p>
                  <div className="mt-4">
                    <InviteAdvisorByEmailForm consumerName={consumerName} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-12 text-center px-8">
              {cancelled && (
                <div className="mb-6 w-full max-w-sm rounded-lg bg-[var(--mwm-sage-pale)] border border-[color:var(--mwm-sage-pale)] px-4 py-3 text-sm text-[color:var(--mwm-sage)] text-center">
                  ✓ Request cancelled. You can send a new request any time.
                </div>
              )}
              <div className="text-4xl mb-3">👤</div>
              <p className="text-sm font-medium text-neutral-600">No advisor connected yet</p>
              <p className="mt-1 text-sm text-neutral-400">
                Or find an advisor in our directory who is already on the platform.
              </p>
              <Link
                href="/find-advisor"
                className="mt-4 rounded-lg bg-[color:var(--mwm-navy)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--mwm-navy-light)] transition"
              >
                Find an Advisor
              </Link>
            </div>
          </div>
        )}
      </div>
    )
  }

  const advisor = connection.profiles
  const connectedDate = new Date(connection.accepted_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--mwm-navy)]">My Advisor</h1>
        <p className="mt-1 text-sm text-neutral-500">Manage your advisor connection</p>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-neutral-900">
                {listing?.firm_name ?? advisor?.full_name ?? 'Your Advisor'}
              </h2>
              {listing?.is_fiduciary && (
                <span className="rounded-full bg-[var(--mwm-sage-pale)] px-2 py-0.5 text-xs font-medium text-[color:var(--mwm-sage)]">
                  Fiduciary
                </span>
              )}
            </div>
            {advisor?.full_name && listing?.firm_name && (
              <p className="text-sm text-neutral-500 mt-0.5">{advisor.full_name}</p>
            )}
            {(listing?.city || listing?.state) && (
              <p className="text-sm text-neutral-400 mt-0.5">
                {[listing.city, listing.state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
          <span className="rounded-full bg-[var(--mwm-sage-pale)] px-3 py-1 text-xs font-medium text-[color:var(--mwm-sage)]">
            Connected
          </span>
        </div>

        {listing?.bio && (
          <p className="mt-4 text-sm text-neutral-600 leading-relaxed">{listing.bio}</p>
        )}

        {listing?.credentials && listing.credentials.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {listing.credentials.map(c => (
              <span key={c} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                {c}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center justify-between">
          <div className="text-xs text-neutral-400">
            Connected since {connectedDate}
            {advisor?.email && (
              <span className="ml-3">{advisor.email}</span>
            )}
          </div>
          {listing?.website && (
            <a
              href={listing.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[color:var(--mwm-navy)] hover:underline"
            >
              Visit website
            </a>
          )}
        </div>
      </div>

      {accessLog.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-4">
            Recent Advisor Activity
          </h2>
          <div className="space-y-2">
            {accessLog.map((entry, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">Viewed your plan</span>
                <span className="text-neutral-400">
                  {new Date(entry.accessed_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit'
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">
          Disconnect Advisor
        </h2>
        <p className="text-sm text-neutral-500 mb-4">
          Removing your advisor will immediately revoke their access to your financial plan.
          You can reconnect at any time by accepting a new invitation.
        </p>
        {error && (
          <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </p>
        )}
        <button
          onClick={handleRevoke}
          disabled={isRevoking}
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 transition"
        >
          {isRevoking ? 'Disconnecting...' : 'Disconnect Advisor'}
        </button>
      </div>
    </div>
  )
}
