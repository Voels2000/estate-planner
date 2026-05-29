'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Props = {
  connectionId: string
  advisorName: string
  connectedAt: string
}

const RECENT_MS = 14 * 24 * 60 * 60 * 1000

export function AdvisorConnectedBanner({ connectionId, advisorName, connectedAt }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const connectedMs = new Date(connectedAt).getTime()
    if (Number.isNaN(connectedMs) || Date.now() - connectedMs > RECENT_MS) return

    try {
      const key = `mwm_advisor_connected_banner_dismissed_${connectionId}`
      if (sessionStorage.getItem(key) === '1') return
      setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [connectionId, connectedAt])

  if (!visible) return null

  function dismiss() {
    try {
      sessionStorage.setItem(`mwm_advisor_connected_banner_dismissed_${connectionId}`, '1')
    } catch {}
    setVisible(false)
  }

  return (
    <div className="rounded-xl border border-[color:var(--mwm-sage-pale)] bg-[var(--mwm-sage-pale)] px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-[color:var(--mwm-navy)]">
          {advisorName} is now connected — Estate planning unlocked
        </p>
        <p className="mt-1 text-sm text-[color:var(--mwm-text-secondary)]">
          Your advisor can review your plan and collaborate on strategies. Complete titling and your
          estate checklist together.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/my-advisor"
          className="rounded-lg bg-[var(--mwm-navy)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--mwm-navy-light)]"
        >
          View My Advisor
        </Link>
        <Link
          href="/titling"
          className="rounded-lg border border-[color:var(--mwm-border)] px-3 py-2 text-xs font-medium text-[color:var(--mwm-navy)] hover:bg-white"
        >
          Review titling
        </Link>
        <button type="button" onClick={dismiss} className="text-xs text-neutral-500 hover:text-neutral-800 px-1">
          Dismiss
        </button>
      </div>
    </div>
  )
}
