'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { SetupProgressCounts } from '@/lib/consumer/setupProgressCounts'

type Props = {
  progress: SetupProgressCounts
  wizardComplete: boolean
  onContinueWizard: () => void
  onImport: () => void
  consumerTier: number
}

const SECTIONS = [
  {
    key: 'assets',
    label: 'Assets',
    href: '/assets',
    description: 'Bank accounts, investments, property',
  },
  {
    key: 'income',
    label: 'Income',
    href: '/income',
    description: 'Salary, investment income, pension',
  },
  {
    key: 'expenses',
    label: 'Expenses',
    href: '/expenses',
    description: 'Monthly and annual expenses',
  },
  {
    key: 'liabilities',
    label: 'Liabilities',
    href: '/liabilities',
    description: 'Mortgages, loans, credit cards',
  },
  {
    key: 'insurance',
    label: 'Insurance',
    href: '/insurance',
    description: 'Life and estate insurance policies',
  },
] as const

export function SetupProgressCard({
  progress,
  wizardComplete,
  onContinueWizard,
  onImport,
}: Props) {
  const sections = SECTIONS.map((section) => ({
    ...section,
    count: progress[section.key],
  }))

  const startedCount = sections.filter((s) => s.count > 0).length
  const allStarted = startedCount === sections.length
  const totalItems = sections.reduce((sum, s) => sum + s.count, 0)

  if (allStarted && wizardComplete) {
    return (
      <div className="mb-6 flex items-center justify-between px-1">
        <span className="text-xs text-[color:var(--mwm-text-muted)]">
          Financial picture complete · {totalItems} items entered
        </span>
        <Link
          href="/assets"
          className="text-xs text-[color:var(--mwm-navy)] underline underline-offset-2 hover:text-[color:var(--mwm-navy-light)]"
        >
          Manage →
        </Link>
      </div>
    )
  }

  return (
    <Card className="mb-6">
      <Card.Header>
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-[family-name:var(--font-display)] text-lg text-[color:var(--mwm-navy)]">
            Build your financial picture
          </h3>
          <span className="shrink-0 text-xs text-[color:var(--mwm-text-muted)]">
            {startedCount} of {sections.length} sections started
          </span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-[var(--mwm-border)]">
          <div
            className="h-1.5 rounded-full bg-[var(--mwm-gold)] transition-all duration-500"
            style={{ width: `${(startedCount / sections.length) * 100}%` }}
          />
        </div>
      </Card.Header>

      <Card.Body>
        <div className="mb-5 space-y-3">
          {sections.map((section) => (
            <div key={section.key} className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                {section.count > 0 ? (
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--mwm-sage)]">
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                ) : (
                  <div className="h-5 w-5 shrink-0 rounded-full border-2 border-[color:var(--mwm-border)]" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[color:var(--mwm-navy)]">
                    {section.label}
                    {section.count > 0 && (
                      <span className="ml-1.5 text-xs font-normal text-[color:var(--mwm-text-muted)]">
                        {section.count} {section.count === 1 ? 'item' : 'items'}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[color:var(--mwm-text-muted)]">{section.description}</p>
                </div>
              </div>
              <Link
                href={section.href}
                className="shrink-0 whitespace-nowrap text-xs text-[color:var(--mwm-navy)] underline underline-offset-2 hover:text-[color:var(--mwm-navy-light)]"
              >
                {section.count > 0 ? 'Add more →' : 'Add →'}
              </Link>
            </div>
          ))}
        </div>

        <div className="mb-5 border-t border-[color:var(--mwm-border)] pt-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-[color:var(--mwm-text-muted)]">
            <span aria-hidden>🔒</span>
            <span>Retirement Planning — upgrade to unlock</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[color:var(--mwm-text-muted)]">
            <span aria-hidden>🔒</span>
            <span>Estate Planning — upgrade to unlock</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {!wizardComplete && (
            <Button variant="gold" size="sm" onClick={onContinueWizard}>
              Guided setup →
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onImport}>
            Import from spreadsheet
          </Button>
        </div>

        <p className="mt-4 border-t border-[color:var(--mwm-border)] pt-3 text-xs text-[color:var(--mwm-text-muted)]">
          A financial advisor can help you interpret your financial picture and identify early
          planning opportunities.{' '}
          <Link
            href="/find-advisor"
            className="text-[color:var(--mwm-navy)] underline underline-offset-2"
          >
            Find an advisor →
          </Link>
        </p>
      </Card.Body>
    </Card>
  )
}

export function SetupProgressCardSkeleton() {
  return (
    <Card className="mb-6 animate-pulse">
      <Card.Header>
        <div className="h-5 w-48 rounded bg-[var(--mwm-border)]" />
        <div className="mt-2 h-1.5 rounded-full bg-[var(--mwm-border)]" />
      </Card.Header>
      <Card.Body className="space-y-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-10 rounded bg-[var(--mwm-border)]/60" />
        ))}
      </Card.Body>
    </Card>
  )
}
