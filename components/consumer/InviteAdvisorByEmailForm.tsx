'use client'

import { useState } from 'react'
import { formControlClass, formLabelClass } from '@/components/ui/form'

type Props = {
  consumerName: string
  onSuccess?: () => void
  completeOnboarding?: boolean
  submitLabel?: string
}

export function InviteAdvisorByEmailForm({
  consumerName,
  onSuccess,
  completeOnboarding = false,
  submitLabel = 'Send invite',
}: Props) {
  const [advisorEmail, setAdvisorEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const trimmedEmail = advisorEmail.trim()
    if (!trimmedEmail) {
      setError('Please enter your advisor’s email address.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/consumer/invite-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          advisorEmail: trimmedEmail,
          message: message.trim() || undefined,
          completeOnboarding,
        }),
      })
      const data = (await res.json()) as { error?: string; message?: string }

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to send invite')
      }

      setSuccess(data.message ?? `Invitation sent to ${trimmedEmail}`)
      setAdvisorEmail('')
      setMessage('')
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="advisorEmail" className={formLabelClass}>
          Advisor email
        </label>
        <input
          id="advisorEmail"
          type="email"
          required
          autoComplete="email"
          value={advisorEmail}
          onChange={(e) => setAdvisorEmail(e.target.value)}
          className={formControlClass}
          placeholder="advisor@firm.com"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="inviteMessage" className={formLabelClass}>
          Optional message
        </label>
        <textarea
          id="inviteMessage"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={formControlClass}
          placeholder={`Hi — I'd like to connect on My Wealth Maps so you can review my plan.`}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--mwm-navy)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--mwm-navy-light)] transition-colors disabled:opacity-50"
      >
        {submitting ? 'Sending…' : submitLabel}
      </button>

      <p className="text-xs text-neutral-500">
        We&apos;ll email your advisor a secure link to join or connect. Signed as {consumerName}.
      </p>
    </form>
  )
}
