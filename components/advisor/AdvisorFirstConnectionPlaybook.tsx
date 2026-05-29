'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Props = {
  clientId: string
  clientName: string
}

const STORAGE_KEY = 'mwm_advisor_first_connection_playbook_dismissed'

export function AdvisorFirstConnectionPlaybook({ clientId, clientName }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return
      setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {}
    setVisible(false)
  }

  return (
    <div className="rounded-2xl border border-[color:var(--mwm-gold)] bg-[var(--mwm-gold-pale)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--mwm-navy)]">
            First client connected
          </p>
          <h2 className="mt-1 text-base font-semibold text-[color:var(--mwm-navy)]">
            Your playbook for {clientName}
          </h2>
          <ol className="mt-3 space-y-2 text-sm text-[color:var(--mwm-navy)]">
            <li>
              1.{' '}
              <Link href={`/advisor/clients/${clientId}`} className="underline font-medium">
                Review Overview
              </Link>{' '}
              — health score, gaps, and alerts
            </li>
            <li>
              2.{' '}
              <Link href={`/advisor/clients/${clientId}?tab=strategy`} className="underline font-medium">
                Send a strategy recommendation
              </Link>{' '}
              — client accepts or declines in their dashboard
            </li>
            <li>
              3.{' '}
              <Link href={`/advisor/clients/${clientId}?tab=meeting-prep`} className="underline font-medium">
                Export meeting prep
              </Link>{' '}
              — share a brief with your client by email
            </li>
          </ol>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 text-xs text-neutral-500 hover:text-neutral-800"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
