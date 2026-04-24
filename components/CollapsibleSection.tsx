'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'

function readSectionState(key: string, defaultOpen: boolean): boolean {
  if (typeof window === 'undefined') return defaultOpen
  try {
    const val = localStorage.getItem(key)
    if (val === null) return defaultOpen
    return val === 'true'
  } catch {
    return defaultOpen
  }
}

function writeSectionState(key: string, open: boolean) {
  try {
    localStorage.setItem(key, String(open))
  } catch {
    // ignore — storage may be unavailable
  }
}

/** Persists open/close state to localStorage — same behavior as dashboard sections. */
export function CollapsibleSection({
  title,
  subtitle,
  badge,
  defaultOpen,
  storageKey,
  locked,
  lockedMessage,
  lockedHref,
  lockedHrefLabel,
  children,
}: {
  title: string
  subtitle?: string
  badge?: ReactNode
  defaultOpen: boolean
  storageKey?: string
  locked?: boolean
  lockedMessage?: string
  lockedHref?: string
  lockedHrefLabel?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setMounted(true)
      if (storageKey) {
        setOpen(readSectionState(storageKey, defaultOpen))
      } else if (defaultOpen) {
        setOpen(true)
      }
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [defaultOpen, storageKey])

  function toggle() {
    const next = !open
    setOpen(next)
    if (storageKey) writeSectionState(storageKey, next)
  }

  return (
    <div className="mb-6 bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-neutral-50 transition"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-neutral-900">{title}</span>
              {badge}
            </div>
            {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <span
          className={`text-neutral-400 text-lg transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}
        >
          ⌄
        </span>
      </button>
      {mounted && open && (
        <div className="border-t border-neutral-100">
          {locked ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-neutral-500 mb-3">{lockedMessage}</p>
              {lockedHref && (
                <Link
                  href={lockedHref}
                  className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-700 transition"
                >
                  {lockedHrefLabel ?? 'Get started'} →
                </Link>
              )}
            </div>
          ) : (
            <div className="px-6 py-5">{children}</div>
          )}
        </div>
      )}
    </div>
  )
}
