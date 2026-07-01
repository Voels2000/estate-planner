'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ConsumerAttorneyBillingBlockedAlert,
  useConsumerAttorneyBillingGateMessage,
} from '@/components/attorney/AttorneyConnectionBillingGateModals'

export function AttorneyInviteAcceptClient({
  token,
  isLoggedIn,
  invitedEmail,
}: {
  token: string
  isLoggedIn: boolean
  invitedEmail: string | null
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(isLoggedIn)
  const [error, setError] = useState<string | null>(null)
  const { blocked, blockedMessage, applyGateResponse } = useConsumerAttorneyBillingGateMessage()

  useEffect(() => {
    if (!isLoggedIn) return

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/attorney/accept-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return

        if (applyGateResponse(data, res.status)) {
          setLoading(false)
          return
        }

        if (!res.ok) {
          if (data.error === 'missing_household') {
            router.replace('/dashboard?attorney_invite=missing_household')
            return
          }
          setError(typeof data.error === 'string' ? data.error : 'Unable to accept invitation')
          setLoading(false)
          return
        }

        router.replace('/dashboard')
      } catch {
        if (!cancelled) {
          setError('Something went wrong. Please try again.')
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isLoggedIn, token, router, applyGateResponse])

  if (!isLoggedIn) {
    const signupHref = `/signup?email=${encodeURIComponent(invitedEmail ?? '')}&redirectTo=${encodeURIComponent(`/attorney-invite/${token}`)}`
    router.replace(signupHref)
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-neutral-600">
        Redirecting to sign in…
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-neutral-600">
        Accepting your attorney invitation…
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-neutral-50">
      <div className="max-w-md w-full rounded-xl border border-neutral-200 bg-white p-6 shadow-sm space-y-4">
        {blocked && blockedMessage ? (
          <>
            <h1 className="text-lg font-semibold text-[color:var(--mwm-navy)]">
              Connection not available yet
            </h1>
            <ConsumerAttorneyBillingBlockedAlert message={blockedMessage} />
            <Link href="/dashboard" className="text-sm text-[color:var(--mwm-navy)] underline">
              Back to dashboard
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-red-700">Could not accept invitation</h1>
            <p className="text-sm text-neutral-600">{error ?? 'Please try again later.'}</p>
            <Link href="/dashboard" className="text-sm text-[color:var(--mwm-navy)] underline">
              Back to dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
