'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AssetAllocationSummary, type AssetAllocationContext } from '@/components/AssetAllocationSummary'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import WhatHappensWalkthrough from '@/components/estate-flow/WhatHappensWalkthrough'
import AlertCenter from '@/components/alerts/AlertCenter'
import type { CompletionScore } from '@/lib/get-completion-score'
import type { EstateHealthScore } from '@/lib/estate-health-score'
import { scoreBg, scoreColor, scoreLabel } from '@/lib/estate-health-score'
import { FeedbackButton } from './_components/feedback-button'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SetupStep = {
  key: string
  label: string
  href: string
  done: boolean
}

type RetirementSnapshot = {
  retirementAge: number | null
  yearsToRetirement: number | null
  ssBenefitMonthly: number | null
  ssClaimingAge: number | null
  projectedIncomeGap: number | null // annual gap at retirement (negative = shortfall)
  monteCarloProbability: number | null // 0-100
  hasLifetimeSnapshot: boolean
}

type Props = {
  userName: string
  // Financial Summary
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  netWorthBySource: {
    financial: number
    realEstateEquity: number
    business: number
    insurance: number
  }
  totalIncome: number
  totalExpenses: number
  savingsRate: number
  allocationContext: AssetAllocationContext
  // Retirement Summary
  retirementSnapshot: RetirementSnapshot | null
  // Estate Summary
  estateHealthScore?: EstateHealthScore | null
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
  currentFederalTax: number
  sunsetFederalTax: number
  stateTax: number
  stateCode?: string
  // Setup / meta
  setupSteps: SetupStep[]
  completedSteps: number
  progressPct: number
  userId: string
  householdId?: string | null
  hasBaseCase?: boolean
  scenarioId?: string | null
  completionScore?: CompletionScore | null
  consumerTier?: number
  isAdvisor?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDollars(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function formatDollarsLong(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

// Data sufficiency checks — used to determine whether a section can render or needs a prompt
function hasFinancialData(props: Props) {
  return props.totalAssets > 0 || props.totalIncome > 0
}

function hasRetirementData(props: Props) {
  return !!(
    props.retirementSnapshot &&
    (props.retirementSnapshot.retirementAge ||
      props.retirementSnapshot.ssBenefitMonthly ||
      props.retirementSnapshot.projectedIncomeGap !== null)
  )
}

function hasEstateData(props: Props) {
  return props.hasBaseCase && props.netWorth > 0
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  label, value, sub, icon, highlight,
}: {
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

function NetWorthBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.max(2, Math.round((value / total) * 100)) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-xs text-neutral-500 shrink-0">{label}</span>
      <div className="flex-1 bg-neutral-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-20 text-right text-xs font-semibold text-neutral-700">{formatDollars(value)}</span>
    </div>
  )
}

/** Collapsible section wrapper */
function CollapsibleSection({
  title,
  subtitle,
  badge,
  defaultOpen,
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
  locked?: boolean
  lockedMessage?: string
  lockedHref?: string
  lockedHrefLabel?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="mb-6 bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      {/* Header — always clickable */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
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
        <span className={`text-neutral-400 text-lg transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}>
          ⌄
        </span>
      </button>

      {/* Body */}
      {open && (
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DashboardClient(props: Props) {
  const {
    userName,
    totalAssets, totalLiabilities, netWorth, netWorthBySource,
    totalIncome, totalExpenses, savingsRate, allocationContext,
    retirementSnapshot,
    estateHealthScore, conflictReport, currentFederalTax, sunsetFederalTax, stateTax, stateCode,
    setupSteps, completedSteps, progressPct,
    userId, householdId, hasBaseCase, scenarioId,
    completionScore, consumerTier, isAdvisor,
  } = props

  void consumerTier
  void isAdvisor

  const firstName = userName.split(' ')[0]
  const allDone = completedSteps === setupSteps.length
  const [greeting, setGreeting] = useState('Good morning')
  const [showWalkthrough, setShowWalkthrough] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    const hour = new Date().getHours()
    setGreeting(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening')
  }, [])

  async function handleGenerateBaseCase() {
    if (!householdId) return
    setGenerating(true)
    try {
      const res = await fetch('/api/consumer/generate-base-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId }),
      })
      const data = await res.json()
      if (data.success) window.location.reload()
      else alert('Failed to generate: ' + data.error)
    } finally {
      setGenerating(false)
    }
  }

  const debtToAsset = totalAssets > 0 ? Math.round((totalLiabilities / totalAssets) * 100) : 0
  const totalNetWorthSources =
    netWorthBySource.financial + netWorthBySource.realEstateEquity +
    netWorthBySource.business + netWorthBySource.insurance

  // Sunset exposure delta
  const sunsetDelta = sunsetFederalTax - currentFederalTax

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-neutral-900" suppressHydrationWarning>
            {greeting}, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            {allDone
              ? "Your estate plan is up to date. Here's your financial snapshot."
              : `You're ${progressPct}% set up. Complete the steps below to get the most out of Estate Planner.`}
          </p>
        </div>
        {hasBaseCase && householdId && (
          <button
            type="button"
            onClick={handleGenerateBaseCase}
            disabled={generating}
            className="shrink-0 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 transition"
          >
            {generating ? 'Regenerating…' : '↻ Regenerate Estate Plan'}
          </button>
        )}
      </div>

      {/* ── Setup Progress (always top if incomplete) ────────────── */}
      {!allDone && (
        <div className="mb-6 bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-900">Setup Progress</h2>
            <span className="text-sm font-semibold text-neutral-500">
              {completedSteps} of {setupSteps.length} complete
            </span>
          </div>
          <div className="w-full bg-neutral-100 rounded-full h-2.5 mb-5">
            <div
              className="bg-neutral-900 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {setupSteps.map((step) => (
              <Link
                key={step.key}
                href={step.href}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition hover:shadow-sm ${
                  step.done
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                }`}
              >
                <span className="text-lg">{step.done ? '✅' : '⭕'}</span>
                <span className={`font-medium ${step.done ? 'line-through opacity-60' : ''}`}>{step.label}</span>
                {!step.done && <span className="ml-auto text-xs text-neutral-400">→</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Generate estate plan CTA (no base case yet) ─────────── */}
      {!hasBaseCase && householdId && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 mb-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-1">Generate Your Estate Plan</h3>
          <p className="text-xs text-blue-700 mb-3">
            You have entered your data. Generate your estate plan to see your tax exposure, estate flow, and planning gaps.
          </p>
          <button
            type="button"
            onClick={handleGenerateBaseCase}
            disabled={generating}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {generating ? 'Generating…' : 'Generate My Estate Plan'}
          </button>
        </div>
      )}

      {/* ── Tier unlock prompt ───────────────────────────────────── */}
      {completionScore && !completionScore.unlocked && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">🔓 Unlock Estate Planning</h2>
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

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — Financial Summary (expanded by default)       */}
      {/* ══════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Financial Summary"
        subtitle={hasFinancialData(props) ? `Net worth ${formatDollars(netWorth)}` : 'Add assets and income to see your summary'}
        defaultOpen={true}
        locked={!hasFinancialData(props)}
        lockedMessage="Add your assets, liabilities, income, and expenses to see your full financial summary."
        lockedHref="/assets"
        lockedHrefLabel="Add assets"
      >
        {/* Net worth headline */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">Net Worth</p>
          <p className={`text-4xl font-bold mb-1 ${netWorth >= 0 ? 'text-neutral-900' : 'text-red-600'}`}>
            {formatDollars(netWorth)}
          </p>
          <p className="text-xs text-neutral-400">Total assets minus liabilities</p>
        </div>

        {/* Net worth breakdown by source */}
        {totalNetWorthSources > 0 && (
          <div className="mb-6 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">By Source</p>
            <NetWorthBar label="Financial Assets" value={netWorthBySource.financial} total={totalNetWorthSources} color="bg-blue-500" />
            <NetWorthBar label="Real Estate Equity" value={netWorthBySource.realEstateEquity} total={totalNetWorthSources} color="bg-emerald-500" />
            <NetWorthBar label="Business Interests" value={netWorthBySource.business} total={totalNetWorthSources} color="bg-violet-500" />
            <NetWorthBar label="Insurance (non-ILIT)" value={netWorthBySource.insurance} total={totalNetWorthSources} color="bg-amber-400" />
            <div className="flex items-center gap-3 pt-1 border-t border-neutral-100 mt-2">
              <span className="w-32 text-xs text-neutral-400 shrink-0">Total Liabilities</span>
              <div className="flex-1" />
              <span className="w-20 text-right text-xs font-semibold text-red-500">− {formatDollars(totalLiabilities)}</span>
            </div>
          </div>
        )}

        {/* Income / expense cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
            value={totalAssets > 0 ? `${debtToAsset}%` : '—'}
            sub="Liabilities / assets"
            icon="📉"
            highlight={totalAssets > 0 && debtToAsset < 50 ? 'green' : 'yellow'}
          />
        </div>

        {/* Asset allocation */}
        <AssetAllocationSummary context={allocationContext} />
      </CollapsibleSection>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — Retirement Summary (collapsed by default)     */}
      {/* ══════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Retirement Summary"
        subtitle={
          hasRetirementData(props) && retirementSnapshot
            ? retirementSnapshot.yearsToRetirement !== null
              ? `${retirementSnapshot.yearsToRetirement} years to retirement · SS ${retirementSnapshot.ssBenefitMonthly ? formatDollars(retirementSnapshot.ssBenefitMonthly) + '/mo' : 'not set'}`
              : 'Retirement data on file'
            : 'Complete retirement inputs to see your snapshot'
        }
        defaultOpen={false}
        locked={!hasRetirementData(props)}
        lockedMessage="Complete your retirement profile — including Social Security, income sources, and retirement age — to see your retirement snapshot."
        lockedHref="/retirement"
        lockedHrefLabel="Go to Retirement Planning"
      >
        {retirementSnapshot && (
          <div className="space-y-5">
            {/* Key stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                <p className="text-xs text-neutral-400 mb-1">Retirement Age</p>
                <p className="text-xl font-bold text-neutral-900">
                  {retirementSnapshot.retirementAge ?? '—'}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                <p className="text-xs text-neutral-400 mb-1">Years Away</p>
                <p className="text-xl font-bold text-neutral-900">
                  {retirementSnapshot.yearsToRetirement ?? '—'}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                <p className="text-xs text-neutral-400 mb-1">SS Benefit / mo</p>
                <p className="text-xl font-bold text-neutral-900">
                  {retirementSnapshot.ssBenefitMonthly
                    ? formatDollars(retirementSnapshot.ssBenefitMonthly)
                    : '—'}
                </p>
                {retirementSnapshot.ssClaimingAge && (
                  <p className="text-[10px] text-neutral-400">at age {retirementSnapshot.ssClaimingAge}</p>
                )}
              </div>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                <p className="text-xs text-neutral-400 mb-1">
                  {retirementSnapshot.monteCarloProbability !== null ? 'Monte Carlo Success' : 'Income Gap / yr'}
                </p>
                <p className={`text-xl font-bold ${
                  retirementSnapshot.monteCarloProbability !== null
                    ? retirementSnapshot.monteCarloProbability >= 80 ? 'text-emerald-600' : retirementSnapshot.monteCarloProbability >= 60 ? 'text-amber-600' : 'text-red-600'
                    : retirementSnapshot.projectedIncomeGap !== null && retirementSnapshot.projectedIncomeGap < 0 ? 'text-red-600' : 'text-emerald-600'
                }`}>
                  {retirementSnapshot.monteCarloProbability !== null
                    ? `${retirementSnapshot.monteCarloProbability}%`
                    : retirementSnapshot.projectedIncomeGap !== null
                      ? formatDollars(Math.abs(retirementSnapshot.projectedIncomeGap))
                      : '—'}
                </p>
                {retirementSnapshot.projectedIncomeGap !== null && retirementSnapshot.monteCarloProbability === null && (
                  <p className="text-[10px] text-neutral-400">
                    {retirementSnapshot.projectedIncomeGap < 0 ? 'annual shortfall' : 'annual surplus'}
                  </p>
                )}
              </div>
            </div>

            {/* Income gap context */}
            {retirementSnapshot.projectedIncomeGap !== null && retirementSnapshot.projectedIncomeGap < 0 && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 flex items-start gap-3">
                <span className="text-red-500 text-lg mt-0.5">⚠</span>
                <div>
                  <p className="text-sm font-semibold text-red-800">Projected Income Gap Identified</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    Your projected retirement income falls short by {formatDollars(Math.abs(retirementSnapshot.projectedIncomeGap))} per year.
                    Review your retirement income plan.
                  </p>
                </div>
              </div>
            )}

            {/* Monte Carlo context */}
            {retirementSnapshot.monteCarloProbability !== null && (
              <div className={`rounded-xl border px-4 py-3 ${
                retirementSnapshot.monteCarloProbability >= 80
                  ? 'border-emerald-100 bg-emerald-50'
                  : retirementSnapshot.monteCarloProbability >= 60
                    ? 'border-amber-100 bg-amber-50'
                    : 'border-red-100 bg-red-50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-neutral-700">Monte Carlo — Probability of Success</p>
                  <span className={`text-sm font-bold ${
                    retirementSnapshot.monteCarloProbability >= 80 ? 'text-emerald-700' :
                    retirementSnapshot.monteCarloProbability >= 60 ? 'text-amber-700' : 'text-red-700'
                  }`}>{retirementSnapshot.monteCarloProbability}%</span>
                </div>
                <div className="w-full bg-white/60 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      retirementSnapshot.monteCarloProbability >= 80 ? 'bg-emerald-500' :
                      retirementSnapshot.monteCarloProbability >= 60 ? 'bg-amber-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${retirementSnapshot.monteCarloProbability}%` }}
                  />
                </div>
              </div>
            )}

            {/* Links */}
            <div className="flex flex-wrap gap-3 pt-1">
              {retirementSnapshot.hasLifetimeSnapshot && (
                <Link href="/retirement/lifetime-snapshot" className="text-xs text-indigo-600 font-medium hover:underline">
                  View lifetime snapshot →
                </Link>
              )}
              <Link href="/retirement/social-security" className="text-xs text-indigo-600 font-medium hover:underline">
                Social Security scenarios →
              </Link>
              <Link href="/retirement/monte-carlo" className="text-xs text-indigo-600 font-medium hover:underline">
                Monte Carlo analysis →
              </Link>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SECTION 3 — Estate Summary (collapsed by default)         */}
      {/* ══════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Estate Summary"
        subtitle={
          hasEstateData(props)
            ? estateHealthScore
              ? `Readiness score ${estateHealthScore.score}/100 · ${formatDollars(netWorth)} estate`
              : `${formatDollars(netWorth)} estate · base case generated`
            : 'Generate your estate plan to see your estate summary'
        }
        badge={
          estateHealthScore ? (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor(estateHealthScore.score)} bg-neutral-100`}>
              {estateHealthScore.score}/100
            </span>
          ) : undefined
        }
        defaultOpen={false}
        locked={!hasEstateData(props)}
        lockedMessage={
          !hasBaseCase
            ? "Generate your estate plan first to unlock your estate summary, tax exposure, and planning gaps."
            : "Add asset and household data to see your estate summary."
        }
        lockedHref={!hasBaseCase ? undefined : '/profile'}
        lockedHrefLabel="Complete your profile"
      >
        <div className="space-y-6">

          {/* Estate Readiness Score */}
          {estateHealthScore && (
            <div className={`rounded-xl border p-5 ${scoreBg(estateHealthScore.score)}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">Estate Readiness Score</p>
                  <div className="flex items-end gap-3">
                    <span className={`text-5xl font-bold ${scoreColor(estateHealthScore.score)}`}>{estateHealthScore.score}</span>
                    <span className="text-neutral-400 text-base mb-1">/ 100</span>
                    <span className={`mb-1 text-sm font-semibold ${scoreColor(estateHealthScore.score)}`}>
                      {scoreLabel(estateHealthScore.score)}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">Based on documents, beneficiaries, titling, and estate exposure</p>
                </div>
                <Link
                  href="/health-check"
                  className="shrink-0 rounded-lg bg-white border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition shadow-sm"
                >
                  Update health check →
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {estateHealthScore.components.map((c) => (
                  <Link
                    key={c.key}
                    href={c.actionHref}
                    className="bg-white rounded-xl border border-neutral-200 px-3 py-3 hover:shadow-sm transition"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-neutral-600 truncate">{c.label}</span>
                      <span className={`text-xs font-bold ml-2 shrink-0 ${
                        c.status === 'good' ? 'text-emerald-600' : c.status === 'warning' ? 'text-amber-600' : 'text-red-600'
                      }`}>{c.score}/{c.maxScore}</span>
                    </div>
                    <div className="w-full bg-neutral-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${
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

          {/* Tax exposure panel */}
          {hasBaseCase && (currentFederalTax > 0 || stateTax > 0 || sunsetFederalTax > 0) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Current Tax Exposure</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                  <p className="text-xs text-neutral-400 mb-1">Federal (current law)</p>
                  <p className="text-lg font-bold text-neutral-900">
                    {currentFederalTax > 0 ? formatDollarsLong(currentFederalTax) : '$0'}
                  </p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">with portability</p>
                </div>
                {stateCode && (
                  <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                    <p className="text-xs text-neutral-400 mb-1">{stateCode} State Tax</p>
                    <p className="text-lg font-bold text-neutral-900">
                      {stateTax > 0 ? formatDollarsLong(stateTax) : '$0'}
                    </p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">at current estate value</p>
                  </div>
                )}
                {sunsetDelta > 0 && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                    <p className="text-xs text-amber-700 mb-1">Sunset 2026 Exposure</p>
                    <p className="text-lg font-bold text-amber-800">+{formatDollarsLong(sunsetDelta)}</p>
                    <p className="text-[10px] text-amber-600 mt-0.5">additional if exemption halves</p>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-neutral-400 mt-2">
                Information only — review with your advisor or attorney before making decisions.
              </p>
            </div>
          )}

          {/* Alerts — AlertCenter handles NY cliff, ILIT gap, gifting gap */}
          {householdId && userId && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Planning Gaps</p>
              <AlertCenter
                householdId={householdId}
                userId={userId}
                runEvaluation={true}
              />
            </div>
          )}

          {/* Titling conflicts — from detectConflicts */}
          {conflictReport && conflictReport.conflicts.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Titling & Beneficiary Conflicts</p>
                {conflictReport.critical > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                    {conflictReport.critical} critical
                  </span>
                )}
                {conflictReport.warnings > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    {conflictReport.warnings} warning{conflictReport.warnings !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
                <div className="divide-y divide-neutral-50">
                  {conflictReport.conflicts.slice(0, 4).map((c, i) => (
                    <div key={i} className="px-4 py-3 flex items-start gap-3">
                      <span className={`mt-0.5 shrink-0 ${
                        c.severity === 'critical' ? 'text-red-500' : c.severity === 'warning' ? 'text-amber-500' : 'text-blue-400'
                      }`}>
                        {c.severity === 'critical' ? '⚠' : c.severity === 'warning' ? '○' : 'ℹ'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-neutral-800">{c.description}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">{c.recommended_action}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {conflictReport.conflicts.length > 4 && (
                  <div className="px-4 py-3 border-t border-neutral-100 text-center">
                    <Link href="/titling" className="text-xs text-indigo-600 hover:underline">
                      View all {conflictReport.conflicts.length} items →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Estate flow walkthrough */}
          {householdId && (
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button
                onClick={() => setShowWalkthrough(true)}
                className="text-xs text-indigo-600 font-medium hover:underline"
              >
                What happens when I die? →
              </button>
              <Link href="/my-estate-strategy" className="text-xs text-indigo-600 font-medium hover:underline">
                View My Estate Strategy →
              </Link>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ── What happens walkthrough modal ──────────────────────── */}
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
              scenarioId={scenarioId ?? null}
              onComplete={() => setShowWalkthrough(false)}
            />
          </div>
        </div>
      )}

      {/* ── Feedback + disclaimer ────────────────────────────────── */}
      <FeedbackButton userId={userId} />
      <div className="mt-8">
        <DisclaimerBanner />
      </div>
    </div>
  )
}
