'use client'

import Link from 'next/link'

interface DashboardOnrampProps {
  foundationScore: number
  firstName: string
  /** Persona must be set before wizard; link persona first when missing. */
  guidedHref: string
}

const PATHS = [
  {
    key: 'import',
    href: '/import',
    icon: '↑',
    label: 'Import my data',
    time: '~2 min',
    desc: 'Connect accounts or upload a file. We map everything automatically.',
    featured: true,
    badge: 'Fastest',
  },
  {
    key: 'guided',
    href: '/onboarding/wizard',
    icon: '→',
    label: 'Guide me through it',
    time: '~10 min',
    desc: 'Step-by-step walkthrough. We ask the questions, you fill in the answers.',
    featured: false,
    badge: null,
  },
  {
    key: 'self',
    href: '/assets',
    icon: '✎',
    label: "I'll enter it myself",
    time: 'At my own pace',
    desc: 'Go section by section on your own schedule.',
    featured: false,
    badge: null,
  },
] as const

export function DashboardOnramp({ foundationScore, firstName, guidedHref }: DashboardOnrampProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-[color:var(--mwm-navy)]">
          Good morning, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-[color:var(--mwm-text-secondary)]">
          Let&apos;s build your estate picture — the more you add, the more valuable this gets.
        </p>
      </div>

      <div className="rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--mwm-radius)] bg-[var(--mwm-sage-pale)] text-sm text-[color:var(--mwm-sage)]">
            🚀
          </div>
          <div>
            <p className="text-sm font-medium text-[color:var(--mwm-navy)]">
              How do you want to get started?
            </p>
            <p className="text-xs text-[color:var(--mwm-text-secondary)]">
              Choose the path that fits your style. You can always switch later.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PATHS.map((path) => (
            <Link
              key={path.key}
              href={path.key === 'guided' ? guidedHref : path.href}
              className={[
                'flex flex-col rounded-[var(--mwm-radius)] border p-4 transition-colors hover:border-[color:var(--mwm-navy-light)]',
                path.featured
                  ? 'border-2 border-[color:var(--mwm-sage)]'
                  : 'border-[color:var(--mwm-border)]',
              ].join(' ')}
            >
              {path.badge && (
                <span className="mb-2 inline-block w-fit rounded-full bg-[var(--mwm-sage-pale)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--mwm-sage)]">
                  {path.badge}
                </span>
              )}
              <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-md bg-[var(--mwm-sage-pale)] text-sm text-[color:var(--mwm-sage)]">
                {path.icon}
              </div>
              <p className="text-sm font-medium text-[color:var(--mwm-navy)]">{path.label}</p>
              <p className="mt-0.5 text-xs text-[color:var(--mwm-text-secondary)]">{path.time}</p>
              <p className="mt-2 text-xs leading-relaxed text-[color:var(--mwm-text-secondary)]">
                {path.desc}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3 border-t border-[color:var(--mwm-border)] pt-4">
          <p className="whitespace-nowrap text-xs text-[color:var(--mwm-text-secondary)]">
            Financial foundation
          </p>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--mwm-bg-muted)]">
            <div
              className="h-full rounded-full bg-[color:var(--mwm-sage)]"
              style={{ width: `${foundationScore}%` }}
            />
          </div>
          <p className="whitespace-nowrap text-xs font-medium text-[color:var(--mwm-sage)]">
            {foundationScore}%
          </p>
        </div>
      </div>

      <div className="rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white p-5 opacity-50">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-[color:var(--mwm-text-secondary)]">
          Estate summary — unlocks as you add data
        </p>
        <div className="grid grid-cols-3 gap-3">
          {['Gross estate', 'Est. federal tax', 'Headroom before tax'].map((label) => (
            <div
              key={label}
              className="rounded-[var(--mwm-radius)] bg-[var(--mwm-bg-muted)] px-3 py-3"
            >
              <p className="text-xs text-[color:var(--mwm-text-secondary)]">{label}</p>
              <p className="mt-1 text-base font-medium text-[color:var(--mwm-navy)]">—</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-[color:var(--mwm-text-secondary)]">
          Complete your financial foundation to see full projections
        </p>
      </div>
    </div>
  )
}
