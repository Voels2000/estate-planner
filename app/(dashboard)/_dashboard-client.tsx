'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AssetAllocationSummary, type AssetAllocationContext } from '@/components/AssetAllocationSummary'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import WhatHappensWalkthrough from '@/components/estate-flow/WhatHappensWalkthrough'
import type { CompletionScore } from '@/lib/get-completion-score'
import type { EstateHealthScore } from '@/lib/estate-health-score'
import { scoreBg, scoreColor, scoreLabel } from '@/lib/estate-health-score'
import { FeedbackButton } from './_components/feedback-button'

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
  userId: string
  householdId?: string | null
  scenarioId?: string | null
  completionScore?: CompletionScore | null
  consumerTier?: number
  allocationContext: AssetAllocationContext
  estateHealthScore?: EstateHealthScore | null
  costOfWaiting?: number
  conflictReport?: {
    conflicts: Array<{
      conflict_type: string
      severity: string
      description: string
      recommended_action: string
    }>
    critical: number
    warnings: number
  } | null
  isAdvisor?: boolean
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
  userId,
  householdId = null,
  scenarioId = null,
  completionScore,
  consumerTier = 1,
  allocationContext,
  estateHealthScore,
  costOfWaiting = 0,
  conflictReport,
  isAdvisor = false,
}: Props) {
  void consumerTier
  void isAdvisor
  const firstName = userName.split(' ')[0]
  const allDone = completedSteps === setupSteps.length
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const [showWalkthrough, setShowWalkthrough] = useState(false)

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

      {estateHealthScore && (
        <div className={`mb-8 rounded-2xl border p-6 shadow-sm ${scoreBg(estateHealthScore.score)}`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">Estate Readiness Score</p>
              <div className="flex items-end gap-3">
                <span className={`text-6xl font-bold ${scoreColor(estateHealthScore.score)}`}>{estateHealthScore.score}</span>
                <span className="text-neutral-400 text-lg mb-1">/ 100</span>
                <span className={`mb-2 text-sm font-semibold ${scoreColor(estateHealthScore.score)}`}>
                  {scoreLabel(estateHealthScore.score)}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Based on your documents, beneficiaries, titling, and estate exposure
              </p>
            </div>

            <Link
              href="/health-check"
              className="shrink-0 rounded-lg bg-white border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition shadow-sm"
            >
              Update health check →
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {estateHealthScore.components.map((c) => (
              <Link
                key={c.key}
                href={c.actionHref}
                className="bg-white rounded-xl border border-neutral-200 px-3 py-3 hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-neutral-600 truncate">{c.label}</span>
                  <span
                    className={`text-xs font-bold ml-2 shrink-0 ${
                      c.status === 'good' ? 'text-emerald-600' : c.status === 'warning' ? 'text-amber-600' : 'text-red-600'
                    }`}
                  >
                    {c.score}/{c.maxScore}
                  </span>
                </div>
                <div className="w-full bg-neutral-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      c.status === 'good' ? 'bg-emerald-500' : c.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${Math.round((c.score / c.maxScore) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-neutral-400 mt-1.5 truncate">{c.actionLabel}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {estateHealthScore && estateHealthScore.score < 75 && (
        <div className="mb-8 bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">Cost of Waiting</p>
              <p className="text-2xl font-bold text-neutral-900">
                {estateHealthScore && costOfWaiting > 0
                  ? formatDollars(costOfWaiting)
                  : '—'}
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                {costOfWaiting > 0
                  ? 'Difference in estate tax: current law vs sunset 2026'
                  : 'Complete your estate strategy to see your cost of waiting'}
              </p>
            </div>
            <Link
              href="/estate-tax"
              className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 transition"
            >
              Review estate tax →
            </Link>
          </div>
        </div>
      )}

      {/* -- Action Items - conflict alerts (Sprint 58) ---------------------- */}
      {(householdId || (conflictReport && conflictReport.conflicts.length > 0)) && (
        <div className="mb-8 bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-neutral-900">Action Items</h2>
              {conflictReport && conflictReport.critical > 0 && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                  {conflictReport.critical} critical
                </span>
              )}
              {conflictReport && conflictReport.warnings > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  {conflictReport.warnings} warning{conflictReport.warnings !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {householdId && (
                <button
                  onClick={() => setShowWalkthrough(true)}
                  className="text-xs text-indigo-600 font-medium hover:underline"
                >
                  What happens when I die?
                </button>
              )}
              {conflictReport && conflictReport.conflicts.length > 0 && (
                <Link href="/titling" className="text-xs text-indigo-600 font-medium hover:underline">
                  Review in Titling & Beneficiaries →
                </Link>
              )}
            </div>
          </div>
          {conflictReport && conflictReport.conflicts.length > 0 ? (
            <div className="divide-y divide-neutral-50">
              {conflictReport.conflicts.slice(0, 5).map((c, i) => (
                <div key={i} className="px-6 py-4 flex items-start gap-4">
                  <span
                    className={`mt-0.5 shrink-0 text-lg ${
                      c.severity === 'critical' ? 'text-red-500' : c.severity === 'warning' ? 'text-amber-500' : 'text-blue-400'
                    }`}
                  >
                    {c.severity === 'critical' ? '⚠' : c.severity === 'warning' ? '○' : 'ℹ'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-800">{c.description}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{c.recommended_action}</p>
                  </div>
                </div>
              ))}
              {conflictReport.conflicts.length > 5 && (
                <div className="px-6 py-3 text-center">
                  <Link href="/titling" className="text-xs text-indigo-600 hover:underline">
                    View all {conflictReport.conflicts.length} items →
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="px-6 py-4 text-sm text-neutral-500">
              Start the walkthrough to see how your estate transfers to your heirs.
            </div>
          )}
          {conflictReport && conflictReport.conflicts.length > 0 && (
            <div className="px-6 py-3 border-t border-neutral-100">
              <DisclaimerBanner context="conflict analysis" />
            </div>
          )}
        </div>
      )}

      {showWalkthrough && householdId && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-4 md:p-6 relative">
            <button
              onClick={() => setShowWalkthrough(false)}
              className="absolute top-3 right-3 text-sm text-neutral-500 hover:text-neutral-800"
            >
              Close
            </button>
            <WhatHappensWalkthrough
              householdId={householdId}
              scenarioId={scenarioId}
              onComplete={() => setShowWalkthrough(false)}
            />
          </div>
        </div>
      )}

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

      {completionScore && !completionScore.unlocked && (
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">
                🔓 Unlock Estate Planning
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Complete {completionScore.threshold} of {completionScore.total} Retirement Planning steps
              </p>
            </div>
            <Link
              href="/unlock-estate"
              className="shrink-0 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-200 transition"
            >
              View checklist →
            </Link>
          </div>
          <div className="w-full bg-amber-100 rounded-full h-2.5 mb-3">
            <div
              className="bg-amber-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((completionScore.completed / completionScore.total) * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-amber-700">
            <span>{completionScore.completed} of {completionScore.total} complete</span>
            <span>
              {completionScore.threshold - completionScore.completed > 0
                ? `${completionScore.threshold - completionScore.completed} more step${completionScore.threshold - completionScore.completed === 1 ? '' : 's'} to unlock`
                : '🎉 Ready to unlock!'}
            </span>
          </div>
        </div>
      )}

      {/* Net worth banner - moved below score (Sprint 56) */}
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

      <div className="mb-8">
        <AssetAllocationSummary context={allocationContext} />
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

function formatDollars(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}
