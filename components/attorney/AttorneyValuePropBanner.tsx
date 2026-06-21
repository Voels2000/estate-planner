'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'mwm_attorney_value_prop_dismissed'

export function AttorneyValuePropBanner() {
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
            Walk into every matter already prepared
          </h2>
          <p className="mt-2 text-sm text-[color:var(--mwm-text-secondary)] leading-relaxed max-w-3xl">
            My Wealth Maps gives you a structured, read-only view of a client&apos;s financial and estate picture
            before the first meeting — assets, beneficiaries, existing documents, and open gaps in one place. You
            spend your time on drafting and counsel, not on assembling the file.
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
          <p className="text-xs font-semibold text-[color:var(--mwm-navy)]">The full picture, organized</p>
          <p className="mt-1.5 text-sm text-neutral-600 leading-relaxed">
            Client financials, beneficiaries, and existing instruments arrive structured and ready to review — so
            you start from a complete file instead of building one from scattered statements.
          </p>
        </div>
        <div className="bg-white px-5 py-4">
          <p className="text-xs font-semibold text-[color:var(--mwm-navy)]">Gaps surfaced before you draft</p>
          <p className="mt-1.5 text-sm text-neutral-600 leading-relaxed">
            The platform flags estate exposure, exemption headroom, and open gaps on live data — so the issues
            worth your attention are visible from the first read.
          </p>
        </div>
        <div className="bg-white px-5 py-4">
          <p className="text-xs font-semibold text-[color:var(--mwm-navy)]">Intake without the back-and-forth</p>
          <p className="mt-1.5 text-sm text-neutral-600 leading-relaxed">
            Send a branded intake request and clients complete their profile before they arrive. Documents you
            upload stay in one secure workspace tied to the matter.
          </p>
        </div>
      </div>
    </div>
  )
}
