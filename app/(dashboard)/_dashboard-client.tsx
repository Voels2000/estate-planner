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
  // Person 1
  p1Name: string | null
  p1RetirementAge: number | null
  p1SSClaimingAge: number | null
  p1MonthlyBenefit: number | null
  p1BirthYear: number | null
  // Person 2
  p2Name: string | null
  p2RetirementAge: number | null
  p2SSClaimingAge: number | null
  p2MonthlyBenefit: number | null
  hasSpouse: boolean
  // Combined
  yearsToRetirement: number | null
  combinedSSMonthly: number | null
  projectedAnnualIncome: number | null
  projectedAnnualExpenses: number | null
  projectedIncomeGap: number | null // positive = surplus, negative = shortfall
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

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function fmtLong(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function firstName(name: string | null | undefined) {
  if (!name) return ''
  return name.trim().split(' ')[0]
}

function hasFinancialData(props: Props) {
  return props.totalAssets > 0 || props.totalIncome > 0
}

function hasRetirementData(props: Props) {
  const s = props.retirementSnapshot
  if (!s) return false
  return !!(s.p1RetirementAge || s.p1MonthlyBenefit || s.p2MonthlyBenefit)
}

// Estate summary shows when household has assets — no base case required for score/alerts.
// Tax panel only shows when base case exists.
function hasEstateData(props: Props) {
  return props.totalAssets > 0
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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
        highlight === 'red' ? 'text-red-600' : 'text-neutral-900'
      }`}>{value}</p>
      <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>
    </div>
  )
}

function NetWorthBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.max(2, Math.round((value / total) * 100)) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-xs text-neutral-500 shrink-0">{label}</span>
      <div className="flex-1 bg-neutral-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-20 text-right text-xs font-semibold text-neutral-700">{fmt(value)}</span>
    </div>
  )
}

function StatBox({ label, value, sub, highlight }: {
  label: string; value: string; sub?: string; highlight?: 'green' | 'red' | 'amber'
}) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
      <p className="text-xs text-neutral-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${
        highlight === 'green' ? 'text-emerald-600' :
        highlight === 'red' ? 'text-red-600' :
        highlight === 'amber' ? 'text-amber-600' : 'text-neutral-900'
      }`}>{value}</p>
      {sub && <p className="text-[10px] text-neutral-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function CollapsibleSection({ title, subtitle, badge, defaultOpen, locked, lockedMessage, lockedHref, lockedHrefLabel, children }: {
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
        <span className={`text-neutral-400 text-lg transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>
      {open && (
        <div className="border-t border-neutral-100">
          {locked ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-neutral-500 mb-3">{lockedMessage}</p>
              {lockedHref && (
                <Link href={lockedHref} className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-700 transition">
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
    userName, totalAssets, totalLiabilities, netWorth, netWorthBySource,
    totalIncome, totalExpenses, savingsRate, allocationContext,
    retirementSnapshot, estateHealthScore, conflictReport,
    currentFederalTax, sunsetFederalTax, stateTax, stateCode,
    setupSteps, completedSteps, progressPct,
    userId, householdId, hasBaseCase, scenarioId,
    completionScore, consumerTier, isAdvisor,
  } = props

  void consumerTier
  void isAdvisor

  const fn = firstName(userName)
  const allDone = completedSteps === setupSteps.length
  const [greeting, setGreeting] = useState('Good morning')
  const [showWalkthrough, setShowWalkthrough] = useState(false)

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
  }, [])

  const debtToAsset = totalAssets > 0 ? Math.round((totalLiabilities / totalAssets) * 100) : 0
  const totalNetWorthSources = netWorthBySource.financial + netWorthBySource.realEstateEquity + netWorthBySource.business + netWorthBySource.insurance
  const sunsetDelta = sunsetFederalTax - currentFederalTax

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-neutral-900" suppressHydrationWarning>
            {greeting}, {fn} 👋
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            {allDone
              ? "Your estate plan is up to date. Here's your financial snapshot."
              : `You're ${progressPct}% set up. Complete the steps below to get the most out of Estate Planner.`}
          </p>
        </div>
        {/* Regenerate only — Generate button moved to My Estate Strategy */}
        {hasBaseCase && householdId && (
          <Link
            href="/my-estate-strategy"
            className="shrink-0 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition"
          >
            View Estate Strategy →
          </Link>
        )}
      </div>

      {/* ── Setup Progress (pinned top when incomplete) ──────────────────── */}
      {!allDone && (
        <div className="mb-6 bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-900">Setup Progress</h2>
            <span className="text-sm font-semibold text-neutral-500">{completedSteps} of {setupSteps.length} complete</span>
          </div>
          <div className="w-full bg-neutral-100 rounded-full h-2.5 mb-5">
            <div className="bg-neutral-900 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {setupSteps.map(step => (
              <Link key={step.key} href={step.href}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition hover:shadow-sm ${
                  step.done ? 'border-green-200 bg-green-50 text-green-700' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                }`}>
                <span className="text-lg">{step.done ? '✅' : '⭕'}</span>
                <span className={`font-medium ${step.done ? 'line-through opacity-60' : ''}`}>{step.label}</span>
                {!step.done && <span className="ml-auto text-xs text-neutral-400">→</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Tier unlock prompt ───────────────────────────────────────────── */}
      {completionScore && !completionScore.unlocked && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">🔓 Unlock Estate Planning</h2>
              <p className="text-xs text-neutral-500 mt-0.5">Complete {completionScore.threshold} of {completionScore.total} Retirement Planning steps</p>
            </div>
            <Link href="/unlock-estate" className="shrink-0 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-200 transition">
              View checklist →
            </Link>
          </div>
          <div className="w-full bg-amber-100 rounded-full h-2.5 mb-3">
            <div className="bg-amber-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.round((completionScore.completed / completionScore.total) * 100)}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-amber-700">
            <span>{completionScore.completed} of {completionScore.total} complete</span>
            <span>{completionScore.threshold - completionScore.completed > 0
              ? `${completionScore.threshold - completionScore.completed} more step${completionScore.threshold - completionScore.completed === 1 ? '' : 's'} to unlock`
              : '🎉 Ready to unlock!'}</span>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — Financial Summary (expanded)                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Financial Summary"
        subtitle={hasFinancialData(props) ? `Net worth ${fmt(netWorth)}` : 'Add assets and income to see your summary'}
        defaultOpen={true}
        locked={!hasFinancialData(props)}
        lockedMessage="Add your assets, liabilities, income, and expenses to see your full financial summary."
        lockedHref="/assets"
        lockedHrefLabel="Add assets"
      >
        {/* Net worth headline */}
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">Net Worth</p>
          <p className={`text-4xl font-bold mb-1 ${netWorth >= 0 ? 'text-neutral-900' : 'text-red-600'}`}>{fmt(netWorth)}</p>
          <p className="text-xs text-neutral-400">Total assets minus liabilities</p>
        </div>

        {/* By source breakdown */}
        {totalNetWorthSources > 0 && (
          <div className="mb-6 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">By Source</p>
            <NetWorthBar label="Financial Assets" value={netWorthBySource.financial} total={totalNetWorthSources} color="bg-blue-500" />
            <NetWorthBar label="Real Estate Equity" value={netWorthBySource.realEstateEquity} total={totalNetWorthSources} color="bg-emerald-500" />
            <NetWorthBar label="Business Interests" value={netWorthBySource.business} total={totalNetWorthSources} color="bg-violet-500" />
            <NetWorthBar label="Insurance (non-ILIT)" value={netWorthBySource.insurance} total={totalNetWorthSources} color="bg-amber-400" />
            <div className="flex items-center gap-3 pt-1 border-t border-neutral-100 mt-2">
              <span className="w-36 text-xs text-neutral-400 shrink-0">Total Liabilities</span>
              <div className="flex-1" />
              <span className="w-20 text-right text-xs font-semibold text-red-500">− {fmt(totalLiabilities)}</span>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard label="Annual Income" value={fmt(totalIncome)} sub="All sources" icon="💰" />
          <SummaryCard label="Annual Expenses" value={fmt(totalExpenses)} sub="All categories" icon="💸" />
          <SummaryCard label="Savings Rate" value={`${savingsRate}%`} sub="Income minus expenses" icon="📊"
            highlight={savingsRate >= 20 ? 'green' : savingsRate >= 10 ? 'yellow' : 'red'} />
          <SummaryCard label="Debt-to-Asset" value={totalAssets > 0 ? `${debtToAsset}%` : '—'} sub="Liabilities / assets" icon="📉"
            highlight={totalAssets > 0 && debtToAsset < 50 ? 'green' : 'yellow'} />
        </div>

        <AssetAllocationSummary context={allocationContext} />
      </CollapsibleSection>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — Retirement Summary (collapsed)                        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Retirement Summary"
        subtitle={hasRetirementData(props) && retirementSnapshot
          ? `${retirementSnapshot.p1RetirementAge ? `Retire at ${retirementSnapshot.p1RetirementAge}` : ''}${retirementSnapshot.yearsToRetirement !== null ? ` · ${retirementSnapshot.yearsToRetirement} years away` : ''}${retirementSnapshot.combinedSSMonthly ? ` · SS ${fmt(retirementSnapshot.combinedSSMonthly)}/mo combined` : ''}`
          : 'Complete your profile to see your retirement snapshot'
        }
        defaultOpen={false}
        locked={!hasRetirementData(props)}
        lockedMessage="Add your retirement age and Social Security PIA on your profile page to see your retirement snapshot."
        lockedHref="/profile"
        lockedHrefLabel="Complete your profile"
      >
        {retirementSnapshot && (
          <div className="space-y-5">

            {/* Key stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBox
                label="Retirement Age"
                value={retirementSnapshot.p1RetirementAge?.toString() ?? '—'}
                sub={retirementSnapshot.yearsToRetirement !== null ? `${retirementSnapshot.yearsToRetirement} years away` : undefined}
              />
              <StatBox
                label="Years to Retirement"
                value={retirementSnapshot.yearsToRetirement?.toString() ?? '—'}
              />
              {retirementSnapshot.projectedAnnualIncome !== null ? (
                <StatBox
                  label="Projected Income at Retirement"
                  value={fmt(retirementSnapshot.projectedAnnualIncome)}
                  sub="SS + RMD + other income"
                  highlight={retirementSnapshot.projectedIncomeGap !== null && retirementSnapshot.projectedIncomeGap >= 0 ? 'green' : undefined}
                />
              ) : (
                <StatBox
                  label="Combined SS / mo"
                  value={retirementSnapshot.combinedSSMonthly ? fmt(retirementSnapshot.combinedSSMonthly) : '—'}
                  sub="at claiming age"
                />
              )}
              {retirementSnapshot.projectedIncomeGap !== null ? (
                <StatBox
                  label={retirementSnapshot.projectedIncomeGap >= 0 ? 'Income Surplus / yr' : 'Income Gap / yr'}
                  value={fmt(Math.abs(retirementSnapshot.projectedIncomeGap))}
                  sub={retirementSnapshot.projectedIncomeGap >= 0 ? 'projected surplus' : 'projected shortfall'}
                  highlight={retirementSnapshot.projectedIncomeGap >= 0 ? 'green' : 'red'}
                />
              ) : (
                <StatBox
                  label="Projected Expenses"
                  value={fmt(totalExpenses)}
                  sub="current annual"
                />
              )}
            </div>

            {/* Per-person SS breakdown */}
            {(retirementSnapshot.p1MonthlyBenefit || retirementSnapshot.p2MonthlyBenefit) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">Social Security</p>
                <div className={`grid gap-3 ${retirementSnapshot.hasSpouse ? 'grid-cols-2' : 'grid-cols-1 max-w-xs'}`}>
                  {retirementSnapshot.p1MonthlyBenefit && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                      <p className="text-xs text-blue-500 mb-1">{firstName(retirementSnapshot.p1Name) || 'You'}</p>
                      <p className="text-lg font-bold text-blue-800">{fmt(retirementSnapshot.p1MonthlyBenefit)}<span className="text-xs font-normal text-blue-500">/mo</span></p>
                      {retirementSnapshot.p1SSClaimingAge && (
                        <p className="text-[10px] text-blue-400 mt-0.5">claiming at {retirementSnapshot.p1SSClaimingAge}</p>
                      )}
                    </div>
                  )}
                  {retirementSnapshot.hasSpouse && retirementSnapshot.p2MonthlyBenefit && (
                    <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">
                      <p className="text-xs text-violet-500 mb-1">{firstName(retirementSnapshot.p2Name) || 'Spouse'}</p>
                      <p className="text-lg font-bold text-violet-800">{fmt(retirementSnapshot.p2MonthlyBenefit)}<span className="text-xs font-normal text-violet-500">/mo</span></p>
                      {retirementSnapshot.p2SSClaimingAge && (
                        <p className="text-[10px] text-violet-400 mt-0.5">claiming at {retirementSnapshot.p2SSClaimingAge}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Income gap alert */}
            {retirementSnapshot.projectedIncomeGap !== null && retirementSnapshot.projectedIncomeGap < 0 && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 flex items-start gap-3">
                <span className="text-red-500 text-lg mt-0.5">⚠</span>
                <div>
                  <p className="text-sm font-semibold text-red-800">Projected Retirement Income Gap</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    At retirement your projected income falls short of expenses by {fmt(Math.abs(retirementSnapshot.projectedIncomeGap))} per year. Review your retirement income plan.
                  </p>
                </div>
              </div>
            )}

            <p className="text-[10px] text-neutral-400">
              Based on profile inputs. SS benefit adjusted for claiming age vs full retirement age. See Retirement Planning for detailed analysis.
            </p>
          </div>
        )}
      </CollapsibleSection>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3 — Estate Summary (collapsed)                            */}
      {/* Gates: score+alerts show when assets > 0; tax panel needs base case */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Estate Summary"
        subtitle={
          hasEstateData(props) && estateHealthScore
            ? `Readiness score ${estateHealthScore.score}/100 · ${fmt(netWorth)} estate`
            : hasEstateData(props)
              ? `${fmt(netWorth)} estate · complete health check for score`
              : 'Add assets to see your estate summary'
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
        lockedMessage="Add your assets to see your estate readiness score, planning gaps, and tax exposure."
        lockedHref="/assets"
        lockedHrefLabel="Add assets"
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
                    <span className={`mb-1 text-sm font-semibold ${scoreColor(estateHealthScore.score)}`}>{scoreLabel(estateHealthScore.score)}</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">Based on documents, beneficiaries, titling, domicile, and estate tax awareness</p>
                </div>
                <Link href="/health-check" className="shrink-0 rounded-lg bg-white border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition shadow-sm">
                  Update health check →
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {estateHealthScore.components.map(c => (
                  <Link key={c.key} href={c.actionHref} className="bg-white rounded-xl border border-neutral-200 px-3 py-3 hover:shadow-sm transition">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-neutral-600 truncate">{c.label}</span>
                      <span className={`text-xs font-bold ml-2 shrink-0 ${c.status === 'good' ? 'text-emerald-600' : c.status === 'warning' ? 'text-amber-600' : 'text-red-600'}`}>
                        {c.score}/{c.maxScore}
                      </span>
                    </div>
                    <div className="w-full bg-neutral-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${c.status === 'good' ? 'bg-emerald-500' : c.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${Math.round((c.score / c.maxScore) * 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-1.5 truncate">{c.actionLabel}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tax exposure — only when base case exists */}
          {hasBaseCase && (currentFederalTax > 0 || stateTax > 0 || sunsetFederalTax > 0) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Current Tax Exposure</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                  <p className="text-xs text-neutral-400 mb-1">Federal (current law)</p>
                  <p className="text-lg font-bold text-neutral-900">{currentFederalTax > 0 ? fmtLong(currentFederalTax) : '$0'}</p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">with portability</p>
                </div>
                {stateCode && (
                  <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                    <p className="text-xs text-neutral-400 mb-1">{stateCode} State Tax</p>
                    <p className="text-lg font-bold text-neutral-900">{stateTax > 0 ? fmtLong(stateTax) : '$0'}</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">at current estate value</p>
                  </div>
                )}
                {sunsetDelta > 0 && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                    <p className="text-xs text-amber-700 mb-1">Sunset 2026 Exposure</p>
                    <p className="text-lg font-bold text-amber-800">+{fmtLong(sunsetDelta)}</p>
                    <p className="text-[10px] text-amber-600 mt-0.5">additional if exemption halves</p>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-neutral-400 mt-2">Information only — review with your advisor or attorney.</p>
            </div>
          )}

          {/* Planning Gaps — AlertCenter */}
          {householdId && userId && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Planning Gaps</p>
              <AlertCenter householdId={householdId} userId={userId} runEvaluation={true} />
            </div>
          )}

          {/* Titling & Beneficiary Conflicts */}
          {conflictReport && conflictReport.conflicts.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Titling & Beneficiary Conflicts</p>
                {conflictReport.critical > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{conflictReport.critical} critical</span>
                )}
                {conflictReport.warnings > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{conflictReport.warnings} warning{conflictReport.warnings !== 1 ? 's' : ''}</span>
                )}
              </div>
              <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
                <div className="divide-y divide-neutral-50">
                  {conflictReport.conflicts.slice(0, 4).map((c, i) => (
                    <div key={i} className="px-4 py-3 flex items-start gap-3">
                      <span className={`mt-0.5 shrink-0 ${c.severity === 'critical' ? 'text-red-500' : c.severity === 'warning' ? 'text-amber-500' : 'text-blue-400'}`}>
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

          {/* Estate flow + strategy links */}
          {householdId && (
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button onClick={() => setShowWalkthrough(true)} className="text-xs text-indigo-600 font-medium hover:underline">
                What happens when I die? →
              </button>
              <Link href="/my-estate-strategy" className="text-xs text-indigo-600 font-medium hover:underline">
                View My Estate Strategy →
              </Link>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ── Walkthrough modal ────────────────────────────────────────────── */}
      {showWalkthrough && householdId && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-4 md:p-6 relative">
            <button onClick={() => setShowWalkthrough(false)} className="absolute top-3 right-3 text-sm text-neutral-500 hover:text-neutral-800">Close</button>
            <WhatHappensWalkthrough householdId={householdId} scenarioId={scenarioId ?? null} onComplete={() => setShowWalkthrough(false)} />
          </div>
        </div>
      )}

      <FeedbackButton userId={userId} />
      <div className="mt-8"><DisclaimerBanner /></div>
    </div>
  )
}
