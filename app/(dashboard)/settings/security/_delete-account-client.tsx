'use client'

import { useState } from 'react'
import Link from 'next/link'

type Props = {
  role: string | null
  subscriptionStatus: string | null
  subscriptionPeriodEnd: string | null
  pendingDeletionAt: string | null
}

function formatDeletionDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function DeleteAccountClient({
  role,
  subscriptionStatus,
  subscriptionPeriodEnd,
  pendingDeletionAt: initialPendingDeletionAt,
}: Props) {
  const [pendingDeletionAt, setPendingDeletionAt] = useState(
    initialPendingDeletionAt,
  )
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isProfessional =
    role === 'advisor' ||
    role === 'financial_advisor' ||
    role === 'attorney' ||
    role === 'admin'

  const needsCancelFirst =
    subscriptionStatus === 'active' || subscriptionStatus === 'trialing'

  async function handleConfirmDelete() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/consumer/delete-account', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Could not schedule account deletion')
      }

      setPendingDeletionAt(data.deletes_at)
      setShowModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-red-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-medium text-neutral-900">Delete account</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Permanently delete your account and personal data. Your account closes at
        the end of your current billing period (if any). We delete your personal
        data within 30 days of that closure, except billing records and a minimal
        deletion audit record as described in our{' '}
        <Link href="/privacy#data-retention" className="underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>

      {pendingDeletionAt && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Deletion scheduled</p>
          <p className="mt-1">
            Your data is scheduled for permanent deletion on{' '}
            <strong>{formatDeletionDate(pendingDeletionAt)}</strong>.
          </p>
        </div>
      )}

      {error && !showModal && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {isProfessional && !pendingDeletionAt && (
        <p className="mt-4 text-sm text-neutral-600">
          Professional accounts must contact{' '}
          <a
            href="mailto:privacy@mywealthmaps.com"
            className="underline underline-offset-2"
          >
            privacy@mywealthmaps.com
          </a>{' '}
          to close an account.
        </p>
      )}

      {needsCancelFirst && !pendingDeletionAt && !isProfessional && (
        <p className="mt-4 text-sm text-neutral-600">
          Cancel your subscription at{' '}
          <Link href="/billing" className="underline underline-offset-2">
            Billing
          </Link>{' '}
          before scheduling account deletion.
        </p>
      )}

      {subscriptionStatus === 'canceling' &&
        subscriptionPeriodEnd &&
        !pendingDeletionAt &&
        !isProfessional && (
          <p className="mt-4 text-sm text-neutral-600">
            Your subscription ends {formatDeletionDate(subscriptionPeriodEnd)}.
            You can schedule account deletion now; data removal begins 30 days
            after that date.
          </p>
        )}

      {!pendingDeletionAt && !isProfessional && !needsCancelFirst && (
        <button
          type="button"
          onClick={() => {
            setError(null)
            setShowModal(true)
          }}
          className="mt-5 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
        >
          Delete my account
        </button>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
        >
          <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-lg">
            <h3
              id="delete-account-title"
              className="text-lg font-semibold text-neutral-900"
            >
              Delete your account?
            </h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-neutral-600">
              <li>
                Your household financial data, profile, and account access will be
                permanently removed.
              </li>
              <li>
                Deletion runs on a 30-day schedule after account closure (see
                Privacy Policy).
              </li>
              <li>
                If you have a canceling subscription, deletion is scheduled 30
                days after your billing period ends.
              </li>
              <li>This action cannot be undone once deletion completes.</li>
            </ul>
            {error && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleConfirmDelete()}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800 disabled:opacity-50"
              >
                {loading ? 'Scheduling…' : 'Yes, schedule deletion'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setShowModal(false)
                  setError(null)
                }}
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
