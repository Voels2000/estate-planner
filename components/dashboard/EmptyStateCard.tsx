import Link from 'next/link'
import type { ReactNode } from 'react'

export interface EmptyStateCardProps {
  message: string
  href: string
  linkLabel: string
  icon?: ReactNode
  /** Tier 1 whisper — advisor note below the main CTA */
  showAdvisorNote?: boolean
}

export function EmptyStateCard({
  message,
  href,
  linkLabel,
  icon,
  showAdvisorNote = false,
}: EmptyStateCardProps) {
  return (
    <section className="rounded-xl border border-dashed border-[color:var(--mwm-border)] bg-[var(--mwm-off-white)] px-5 py-6 text-center">
      {icon && <div className="mb-2 text-2xl">{icon}</div>}
      <p className="text-sm text-[color:var(--mwm-text-secondary)]">{message}</p>
      <Link
        href={href}
        className="mt-3 inline-block text-sm font-medium text-[color:var(--mwm-navy)] hover:underline"
      >
        {linkLabel} →
      </Link>
      {showAdvisorNote && (
        <p className="mt-4 border-t border-[color:var(--mwm-border)] pt-4 text-left text-xs leading-relaxed text-[color:var(--mwm-text-muted)]">
          At this stage, a financial advisor can help you interpret what you&apos;re seeing and
          identify planning opportunities.{' '}
          <Link
            href="/find-advisor"
            className="text-[color:var(--mwm-navy)] underline underline-offset-2"
          >
            Find an advisor →
          </Link>
        </p>
      )}
    </section>
  )
}
