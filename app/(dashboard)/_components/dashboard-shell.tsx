'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

type Props = {
  sidebar: ReactNode
  children: ReactNode
}

/**
 * Consumer app chrome: fixed sidebar on lg+, off-canvas drawer on smaller viewports.
 * Public routes use `(public)/layout` — unaffected.
 */
export function DashboardShell({ sidebar, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  return (
    <div className="min-h-screen bg-[var(--mwm-off-white)]">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--mwm-border)] bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--mwm-border)] text-[var(--mwm-navy)] hover:bg-[var(--mwm-off-white)]"
          aria-expanded={menuOpen}
          aria-controls="dashboard-sidebar"
        >
          <span className="sr-only">Open menu</span>
          <span className="text-lg leading-none" aria-hidden>
            ☰
          </span>
        </button>
        <span className="truncate text-sm font-semibold text-[var(--mwm-navy)]">My Wealth Maps</span>
      </header>

      <div className="flex lg:min-h-screen lg:pt-0">
        {menuOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-neutral-900/40 lg:hidden"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
        )}

        <div
          id="dashboard-sidebar"
          className={`fixed inset-y-0 left-0 z-50 w-[min(17rem,calc(100vw-1rem))] transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-auto lg:shrink-0 lg:translate-x-0 ${
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-full max-h-[100dvh] flex-col p-2 lg:max-h-none lg:p-0">{sidebar}</div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
