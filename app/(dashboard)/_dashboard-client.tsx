'use client'

import Link from 'next/link'
import { FeedbackButton } from '@/components/feedback-button'

type SetupStep = {
  key: string
  label: string
  href: string
  done: boolean
}

type Props = {
  userName: string
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  totalIncome: number
  totalExpenses: number
  savingsRate: number
  setupSteps: SetupStep[]
  completedSteps: number
  progressPct: number
  readinessScore: number
  hasProjection: boolean
  userId: string
}

export function DashboardClient({
  userName,
  totalAssets,
  totalLiabilities,
  netWorth,
  totalIncome,
  totalExpenses,
  savingsRate,
  setupSteps,
  completedSteps,
  progressPct,
  readinessScore,
  hasProjection,
  userId,
}: Props) {
  const firstName = userName.split(' ')[0]
  const allDone = completedSteps === setupSteps.length
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  function readinessColor() {
    if (readinessScore >= 75) return 'text-green-600'
    if (readinessScore >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  function readinessLabel() {
    if (readinessScore >= 75) return 'On Track'
    if (readinessScore >= 50) return 'Needs Attention'
    return 'At Risk'
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">
          {greeting}, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          {allDone
            ? "Your estate plan is up to date. Here's your financial snapshot."
            : `You're ${progressPct}% set up. Complete the steps below to get the most out of Estate Planner.`}
        </p>
      </div>

      {!allDone && (
        <div className="mb-8 bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-900">Setup Progress</h2>
            <span className="text-sm font-semibold text-neutral-500">{completedSteps} of {setupSteps.length} complete</span>
          </div>
          <div className="w-full bg-neutral-100 rounded-full h-2.5 mb-5">
            <div className="bg-neutral-900 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {setupSteps.map((step) => (
              <Link key={step.key} href={step.href}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition hover:shadow-sm ${
                  step.done
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                }`}>
                <span className="text-lg">{step.done ? '✅' : '⭕'}</span>
                <span className={`font-medium ${step.done ? 'line-through opacity-60' : ''}`}>{step.label}</span>
                {!step.done && <span className="ml-auto text-xs text-neutral-400">→</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Net worth banner */}
      <div className="mb-6 bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Net Worth</p>
        <div className="flex items-end gap-6 flex-wrap">
          <div>
            <p className={`text-4xl font-bold ${netWorth >= 0 ? 'text-neutral-900' : 'text-red-600'}`}>
              {formatDollars(netWorth)}
            </p>
            <p className="text-xs text-neutral-400 mt-1">Total assets minus liabilities</p>
          </div>
          <div className="flex gap-6 text-sm pb-1">
            <div>
              <p className="text-xs text-neutral-400">Assets</p>
              <p className="font-semibold text-green-600">{formatDollars(totalAssets)}</p>
            </div>
            <div className="text-neutral-300 self-center text-lg">−</div>
            <div>
              <p className="text-xs text-neutral-400">Liabilities</p>
              <p className="font-semibold text-red-500">{formatDollars(totalLiabilities)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Annual Income" value={formatDollars(totalIncome)} sub="All sources" icon="💰" />
        <SummaryCard label="Annual Expenses" value={formatDollars(totalExpenses)} sub="All categories" icon="💸" />
        <SummaryCard
          label="Savings Rate"
          value={`${savingsRate}%`}
          sub="Income minus expenses"
          icon="📊"
          highlight={savingsRate >= 20 ? 'green' : savingsRate >= 10 ? 'yellow' : 'red'}
        />
        <SummaryCard
          label="Debt-to-Asset"
          value={totalAssets > 0 ? `${Math.round((totalLiabilities / totalAssets) * 100)}%` : '—'}
          sub="Liabilities / assets"
          icon="📉"
          highlight={totalAssets > 0 && (totalLiabilities / totalAssets) < 0.5 ? 'green' : 'yellow'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 flex flex-col items-center justify-center text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">Retirement Readiness</p>
          <div className={`text-6xl font-bold ${readinessColor()}`}>{readinessScore}</div>
          <div className={`text-sm font-semibold mt-1 ${readinessColor()}`}>{readinessLabel()}</div>
          <p className="text-xs text-neutral-400 mt-2">out of 100</p>
          {!hasProjection && (
            <Link href="/projections" className="mt-4 text-xs text-indigo-600 hover:underline">
              Run a projection to improve your score →
            </Link>
          )}
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-neutral-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickAction href="/assets" icon="🏦" label="Add an asset" />
            <QuickAction href="/liabilities" icon="💳" label="Add a liability" />
            <QuickAction href="/income" icon="💰" label="Add income" />
            <QuickAction href="/expenses" icon="💸" label="Add expense" />
            <QuickAction href="/projections" icon="📈" label="Run projection" />
            <QuickAction href="/scenarios" icon="🔮" label="Compare scenarios" />
          </div>
        </div>
      </div>

      <FeedbackButton userId={userId} />
    </div>
  )
}

function SummaryCard({ label, value, sub, icon, highlight }: {
  label: string; value: string; sub: string; icon: string; highlight?: 'green' | 'yellow' | 'red'
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      </div>
      <p className={`text-xl font-bold ${
        highlight === 'green' ? 'text-green-600' :
        highlight === 'yellow' ? 'text-yellow-600' :
        highlight === 'red' ? 'text-red-600' :
        'text-neutral-900'
      }`}>{value}</p>
      <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>
    </div>
  )
}

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href}
      className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 transition">
      <span>{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  )
}

function formatDollars(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}
