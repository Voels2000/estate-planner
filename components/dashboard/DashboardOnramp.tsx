'use client'

import Link from 'next/link'
import type { DashboardUnlockInput } from '@/lib/dashboard/canUnlockDashboard'

interface DashboardOnrampProps {
  firstName: string
  /** Persona must be set before wizard; link persona first when missing. */
  guidedHref: string
  unlock: DashboardUnlockInput
}

const PATHS = [
  {
    key: 'guided',
    hrefKey: 'guided' as const,
    icon: '→',
    label: 'Guide me through it',
    time: '~10 min',
    desc: 'Step-by-step walkthrough. We ask the questions, you fill in the answers.',
  },
  {
    key: 'import',
    hrefKey: 'import' as const,
    icon: '↑',
    label: 'Import my data',
    time: '~2 min',
    desc: 'Upload a broker export (Schwab, Fidelity, Vanguard), Excel workbook, or CSV.',
    hint: 'Broker CSV · Multi-sheet Excel · Single-table CSV',
  },
  {
    key: 'self',
    hrefKey: 'self' as const,
    icon: '✎',
    label: 'Add manually',
    time: 'At my own pace',
    desc: 'Enter assets and income section by section on your own schedule.',
  },
] as const

function UnlockRequirement({
  done,
  label,
  detail,
  href,
}: {
  done: boolean
  label: string
  detail: string
  href: string
}) {
  return (
    <Link
      href={href}
      className={[
        'flex items-start gap-3 rounded-[var(--mwm-radius)] border px-3 py-2.5 transition-colors',
        done
          ? 'border-[color:var(--mwm-sage)] bg-[var(--mwm-sage-pale)]'
          : 'border-[color:var(--mwm-border)] hover:border-[color:var(--mwm-navy-light)]',
      ].join(' ')}
    >
      <span
        className={[
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold',
          done
            ? 'border-[color:var(--mwm-sage)] bg-[color:var(--mwm-sage)] text-white'
            : 'border-[color:var(--mwm-border)] bg-white text-transparent',
        ].join(' ')}
        aria-hidden
      >
        ✓
      </span>
      <span>
        <span className="block text-sm font-medium text-[color:var(--mwm-navy)]">{label}</span>
        <span className="mt-0.5 block text-xs text-[color:var(--mwm-text-secondary)]">{detail}</span>
      </span>
    </Link>
  )
}

export function DashboardOnramp({ firstName, guidedHref, unlock }: DashboardOnrampProps) {
  const { profileComplete, hasAssets, hasIncome } = unlock
  const completedCount = [profileComplete, hasAssets, hasIncome].filter(Boolean).length

  const pathHref = (key: (typeof PATHS)[number]['hrefKey']) => {
    if (key === 'guided') return guidedHref
    if (key === 'import') return '/import'
    if (!hasAssets) return '/assets'
    if (!hasIncome) return '/income'
    return '/assets'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-[color:var(--mwm-navy)]">
          Good morning, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-[color:var(--mwm-text-secondary)]">
          Add your assets and income to unlock your dashboard. Pick any path below — wizard,
          import, or manual entry all work.
        </p>
      </div>

      <div className="rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white p-5">
        <div className="mb-4">
          <p className="text-sm font-medium text-[color:var(--mwm-navy)]">
            Unlock your dashboard
          </p>
          <p className="mt-0.5 text-xs text-[color:var(--mwm-text-secondary)]">
            {completedCount} of 3 requirements complete — all three are required.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <UnlockRequirement
            done={profileComplete}
            label="Profile"
            detail={profileComplete ? 'Household basics on file' : 'Name, state, filing status, birth year'}
            href="/profile"
          />
          <UnlockRequirement
            done={hasAssets}
            label="Assets"
            detail={hasAssets ? 'At least one asset added' : 'Add an account, property, or other asset'}
            href="/assets"
          />
          <UnlockRequirement
            done={hasIncome}
            label="Income"
            detail={hasIncome ? 'At least one income source added' : 'Add salary, pension, or other income'}
            href="/income"
          />
        </div>
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
              Three equal paths — choose what fits you. Switch any time.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PATHS.map((path) => (
            <Link
              key={path.key}
              href={pathHref(path.hrefKey)}
              className="flex flex-col rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] p-4 transition-colors hover:border-[color:var(--mwm-navy-light)]"
            >
              <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-md bg-[var(--mwm-sage-pale)] text-sm text-[color:var(--mwm-sage)]">
                {path.icon}
              </div>
              <p className="text-sm font-medium text-[color:var(--mwm-navy)]">{path.label}</p>
              <p className="mt-0.5 text-xs text-[color:var(--mwm-text-secondary)]">{path.time}</p>
              <p className="mt-2 text-xs leading-relaxed text-[color:var(--mwm-text-secondary)]">
                {path.desc}
              </p>
              {'hint' in path && path.hint && (
                <p className="mt-2 text-[10px] text-[color:var(--mwm-text-secondary)] opacity-75">
                  {path.hint}
                </p>
              )}
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white p-5 opacity-50">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-[color:var(--mwm-text-secondary)]">
          Estate summary — unlocks after your dashboard opens
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
          Estate readiness and tax projections appear once you&apos;re on the full dashboard
        </p>
      </div>
    </div>
  )
}
