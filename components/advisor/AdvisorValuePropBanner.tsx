'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'mwm_advisor_value_prop_dismissed'

export function AdvisorValuePropBanner() {
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
    <div className="rounded-2xl border border-[color:var(--mwm-border)] bg-white shadow-sm overflow-hidden">
      <div className="border-b border-[color:var(--mwm-border)] bg-[var(--mwm-gold-pale)] px-5 py-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--mwm-navy)]">
            Why My Wealth Maps
          </p>
          <h2 className="mt-1 text-base font-semibold text-[color:var(--mwm-navy)]">
            Your clients get a plan they can actually use
          </h2>
          <p className="mt-2 text-sm text-[color:var(--mwm-text-secondary)] leading-relaxed max-w-3xl">
            Most planning portals keep clients on the outside — quarterly PDFs, no ongoing visibility.
            My Wealth Maps gives clients a guided dashboard for financial, retirement, and estate planning.
            You get read-only access to their live data, strategy sandbox, meeting prep, and gap workflow —
            without re-keying their balance sheet.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 text-xs text-neutral-500 hover:text-neutral-800 px-1"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      </div>

      <div className="grid gap-px bg-[color:var(--mwm-border)] sm:grid-cols-3">
        <div className="bg-white px-5 py-4">
          <p className="text-xs font-semibold text-[color:var(--mwm-navy)]">vs. traditional portals</p>
          <p className="mt-1.5 text-sm text-neutral-600 leading-relaxed">
            eMoney and similar tools are advisor-first. Clients get reports — not a living dashboard they
            return to between meetings.
          </p>
        </div>
        <div className="bg-white px-5 py-4">
          <p className="text-xs font-semibold text-[color:var(--mwm-navy)]">B2B2C value</p>
          <p className="mt-1.5 text-sm text-neutral-600 leading-relaxed">
            Connected clients receive Estate-tier access at no extra consumer cost. You collaborate on
            real data; they stay engaged in the plan.
          </p>
        </div>
        <div className="bg-white px-5 py-4">
          <p className="text-xs font-semibold text-[color:var(--mwm-navy)]">Your workflow</p>
          <p className="mt-1.5 text-sm text-neutral-600 leading-relaxed">
            Model strategies in the sandbox, send recommendations clients accept in their dashboard, and
            email meeting prep briefs — all from one client workspace.
          </p>
        </div>
      </div>
    </div>
  )
}
