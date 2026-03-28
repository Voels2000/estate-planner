'use client'

import { useState } from 'react'
import Link from 'next/link'

type AttorneyRow = {
  id: string
  firm_name: string
  contact_name: string | null
  email: string
}

type Props = {
  attorney: Record<string, unknown> | null
  userName: string
  userEmail: string
}

export function ReferralsClient({ attorney, userName, userEmail }: Props) {
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const a = attorney as AttorneyRow | null
  const hasAttorney = a && typeof a.id === 'string' && typeof a.email === 'string' && typeof a.firm_name === 'string'

  async function handleSubmit() {
    if (!hasAttorney || !a) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/attorney-directory/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attorneyId: a.id,
          attorneyEmail: a.email,
          attorneyFirmName: a.firm_name,
          attorneyContactName: a.contact_name,
          userName,
          userEmail,
          note,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        setSending(false)
        return
      }
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6">
        <Link href="/attorney-directory" className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
          ← Attorney directory
        </Link>
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Attorney referral</h1>
      <p className="mt-2 text-neutral-600">
        We will email the attorney with your contact information so they can follow up with you directly.
      </p>

      {!hasAttorney && (
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <p className="text-neutral-600">
            Choose an attorney from the directory and use <strong>Request referral</strong> on their card to start here.
          </p>
          <Link
            href="/attorney-directory"
            className="mt-6 inline-flex rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Browse attorneys
          </Link>
        </div>
      )}

      {hasAttorney && a && !sent && (
        <div className="mt-8 space-y-6 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div>
            <p className="text-sm font-medium text-neutral-500">Referral to</p>
            <p className="text-lg font-semibold text-neutral-900">{a.firm_name}</p>
            {a.contact_name ? (
              <p className="text-sm text-neutral-600">{a.contact_name}</p>
            ) : null}
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Optional message</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={4}
              placeholder="Anything you would like the attorney to know..."
              className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
            />
          </div>

          <p className="text-sm text-neutral-500">
            We will share your name ({userName || '—'}) and email ({userEmail}) with this attorney.
          </p>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending}
            className="w-full rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending…' : 'Send referral request'}
          </button>
        </div>
      )}

      {hasAttorney && sent && (
        <div className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
          <p className="font-medium text-green-900">Your referral request has been sent.</p>
          <p className="mt-2 text-sm text-green-800">Check your email for a confirmation.</p>
          <Link href="/dashboard" className="mt-6 inline-block text-sm font-medium text-green-900 underline underline-offset-4">
            Return to dashboard
          </Link>
        </div>
      )}
    </div>
  )
}
