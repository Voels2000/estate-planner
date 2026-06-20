'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formControlClass, formLabelClass } from '@/components/ui/form'

type Props = {
  open: boolean
  onClose: () => void
  onSent: (email: string) => void
  sentThisMonth: number
  monthlyCap: number | null
}

export function SendIntakeRequestModal({
  open,
  onClose,
  onSent,
  sentThisMonth,
  monthlyCap,
}: Props) {
  const [clientEmail, setClientEmail] = useState('')
  const [clientName, setClientName] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const atCap = monthlyCap != null && sentThisMonth >= monthlyCap

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (atCap) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/attorney/send-intake-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: clientEmail.trim(),
          clientName: clientName.trim() || undefined,
          message: message.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to send invitation')
      }
      onSent(clientEmail.trim())
      setClientEmail('')
      setClientName('')
      setMessage('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-intake-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2
          id="send-intake-title"
          className="font-[family-name:var(--font-display)] text-lg text-[color:var(--mwm-navy)]"
        >
          Send intake request
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          They&apos;ll receive an email with your name and a link to complete their profile before your meeting.
        </p>

        {monthlyCap != null && (
          <p className="mt-3 text-xs text-neutral-500">
            {sentThisMonth} of {monthlyCap} sent this month (free plan)
          </p>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <div>
            <label className={`${formLabelClass} mb-1 block`}>Client email *</label>
            <input
              type="email"
              required
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className={formControlClass}
              placeholder="client@example.com"
              autoFocus
            />
          </div>
          <div>
            <label className={`${formLabelClass} mb-1 block`}>Client name (optional)</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className={formControlClass}
              placeholder="Jane Smith"
            />
          </div>
          <div>
            <label className={`${formLabelClass} mb-1 block`}>Personal message (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={`${formControlClass} min-h-[80px]`}
              placeholder="Looking forward to our meeting next week…"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting || atCap}>
              {submitting ? 'Sending…' : 'Send invitation →'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
