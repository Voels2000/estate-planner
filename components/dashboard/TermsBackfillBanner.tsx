'use client'

import { useEffect, useState } from 'react'

const DISMISS_KEY = 'mwm_terms_backfill_dismissed'

type Props = {
  initialTermsAcceptedAt: string | null
}

export function TermsBackfillBanner({ initialTermsAcceptedAt }: Props) {
  const [termsAcceptedAt, setTermsAcceptedAt] = useState(initialTermsAcceptedAt)
  const [dismissed, setDismissed] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
  }, [])

  if (termsAcceptedAt || dismissed) return null

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  const handleAcceptTerms = async () => {
    setAccepting(true)
    setAcceptError(null)
    try {
      const res = await fetch('/api/terms/accept', { method: 'POST' })
      if (!res.ok) {
        setAcceptError('Could not record acceptance. Please try again.')
        return
      }
      setTermsAcceptedAt(new Date().toISOString())
    } catch {
      setAcceptError('Could not record acceptance. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-[color:var(--mwm-navy)]/10 bg-[color:var(--mwm-navy)]/[0.02] px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-600 dark:text-zinc-400">
          We&apos;ve updated our{' '}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[color:var(--mwm-navy)] underline underline-offset-2 dark:text-indigo-300"
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[color:var(--mwm-navy)] underline underline-offset-2 dark:text-indigo-300"
          >
            Privacy Policy
          </a>
          .
        </p>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:text-neutral-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={handleAcceptTerms}
            disabled={accepting}
            className="rounded-lg bg-[color:var(--mwm-navy)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[color:var(--mwm-navy)]/90 disabled:opacity-50"
          >
            {accepting ? 'Saving…' : 'Accept & continue'}
          </button>
        </div>
      </div>
      {acceptError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{acceptError}</p>}
    </div>
  )
}
