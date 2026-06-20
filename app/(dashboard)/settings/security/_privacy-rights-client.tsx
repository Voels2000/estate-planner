'use client'

import { FormEvent, useState } from 'react'

const REQUEST_OPTIONS = [
  { value: 'deletion', label: 'Delete my personal data' },
  { value: 'access', label: 'Access my personal data' },
  { value: 'correction', label: 'Correct inaccurate data' },
  { value: 'portability', label: 'Export my data (portability)' },
  { value: 'opt_out', label: 'Opt out of sale of my data' },
] as const

export default function PrivacyRightsClient() {
  const [requestType, setRequestType] = useState<string>('access')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{
    id: string
    due_at: string
  } | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/consumer/privacy-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_type: requestType,
          notes: notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Request failed')
      }
      setSuccess({ id: data.id, due_at: data.due_at })
      setNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-medium text-neutral-900">Privacy rights</h2>
      <p className="mt-2 text-sm text-neutral-600">
        As a United States resident, you may request deletion, access, correction,
        portability, or opt-out of sale. We respond within 45 days. If we decline
        a request, you may appeal as described in our{' '}
        <a href="/privacy#appeals" className="underline underline-offset-2">
          Privacy Policy
        </a>
        . You will receive a confirmation email with a reference ID.
      </p>

      {success && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <p className="font-medium">Request submitted</p>
          <p className="mt-1 font-mono text-xs">Reference: {success.id}</p>
          <p className="mt-1 text-xs">
            We will respond by{' '}
            {new Date(success.due_at).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
            .
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {!success && (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="request_type"
              className="block text-xs font-medium text-neutral-500 mb-1"
            >
              Request type
            </label>
            <select
              id="request_type"
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
            >
              {REQUEST_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="privacy_notes"
              className="block text-xs font-medium text-neutral-500 mb-1"
            >
              Additional details (optional)
            </label>
            <textarea
              id="privacy_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
              placeholder="Any context that helps us process your request"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[color:var(--mwm-navy)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--mwm-navy-light)] disabled:opacity-50"
          >
            {loading ? 'Submitting…' : 'Submit privacy request'}
          </button>
        </form>
      )}

      <p className="mt-4 text-xs text-neutral-500">
        You may also email{' '}
        <a href="mailto:privacy@mywealthmaps.com" className="text-[color:var(--mwm-navy)] hover:underline">
          privacy@mywealthmaps.com
        </a>
        . See our{' '}
        <a href="/privacy" className="text-[color:var(--mwm-navy)] hover:underline">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  )
}
