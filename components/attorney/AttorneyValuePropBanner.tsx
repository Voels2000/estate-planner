'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'mwm_attorney_value_prop_dismissed'

const CONDENSED_CARDS = [
  {
    title: 'Full picture before the first meeting',
    body: 'Structured read-only view of assets, beneficiaries, documents, and gaps — before you draft.',
  },
  {
    title: 'Life events surface stale documents',
    body: "When a client's situation changes, the platform flags what's out of date so you're back in front of them.",
  },
  {
    title: 'Pay per connection, not seats',
    body: 'Your first connected client is free; after that you only pay for clients actually connected.',
  },
] as const

const LIFE_EVENT_STAT_LINE =
  "A complex estate matter runs $7,500–$15,000+ — and it's rarely the last one. Marriage, a business sale, a new grandchild, an inherited account: each triggers document updates most clients never think to schedule. My Wealth Maps flags it when it happens, so you're back in front of the client instead of waiting for them to remember."

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
    <div className="rounded-2xl border border-[color:var(--mwm-border)] bg-white shadow-sm overflow-hidden mb-8">
      <div className="border-b border-[color:var(--mwm-border)] bg-[var(--mwm-gold-pale)] px-5 py-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--mwm-navy)]">
            Why My Wealth Maps
          </p>
          <p className="mt-2 text-sm text-[color:var(--mwm-text-secondary)] leading-relaxed max-w-3xl">
            {LIFE_EVENT_STAT_LINE}
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
        {CONDENSED_CARDS.map((card) => (
          <div key={card.title} className="bg-white px-5 py-4">
            <p className="text-xs font-semibold text-[color:var(--mwm-navy)]">{card.title}</p>
            <p className="mt-1.5 text-sm text-neutral-600 leading-relaxed">{card.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
