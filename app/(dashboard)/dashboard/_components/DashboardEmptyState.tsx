import Link from 'next/link'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export function DashboardEmptyState() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <Card className="flex flex-col items-center justify-center border-dashed border-[color:var(--mwm-border)] py-16 text-center">
        <div className="mb-3 text-4xl">🏡</div>
        <p className="text-sm font-medium text-[color:var(--mwm-navy)]">My Estate Plan is not set up yet</p>
        <p className="mt-1 max-w-md text-xs text-[color:var(--mwm-text-secondary)]">
          We could not find a household profile for this account. Complete your profile to create your
          estate plan workspace.
        </p>
        <div className="mt-6">
          <ButtonLink href="/profile" size="sm">
            Complete profile setup →
          </ButtonLink>
        </div>
        <p className="mt-4 max-w-md border-t border-[color:var(--mwm-border)] pt-4 text-left text-xs leading-relaxed text-[color:var(--mwm-text-muted)]">
          At this stage, a financial advisor can help you interpret what you&apos;re seeing and
          identify planning opportunities.{' '}
          <Link
            href="/find-advisor"
            className="text-[color:var(--mwm-navy)] underline underline-offset-2"
          >
            Find an advisor →
          </Link>
        </p>
      </Card>
    </div>
  )
}
