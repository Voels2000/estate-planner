'use client'

import Link from 'next/link'

export type AssetAllocationContext = {
  currentAge: number | null
  birthYear: number | null
  riskTolerance: string | null
  retirementAge: number | null
  maritalStatus: string | null
  dependents: number | null
  hasSpouse: boolean | null
  filingStatus: string | null
}

type Props = {
  context: AssetAllocationContext
}

function normalizeRisk(s: string | null): 'conservative' | 'moderate' | 'aggressive' | 'balanced' {
  const x = (s ?? 'moderate').toLowerCase()
  if (x.includes('conserv')) return 'conservative'
  if (x.includes('aggress')) return 'aggressive'
  if (x.includes('balance')) return 'balanced'
  return 'moderate'
}

function riskLabel(r: ReturnType<typeof normalizeRisk>) {
  switch (r) {
    case 'conservative': return 'Conservative'
    case 'aggressive': return 'Aggressive'
    case 'balanced': return 'Balanced'
    default: return 'Moderate'
  }
}

function computeMix(ctx: AssetAllocationContext, calendarYear: number) {
  const age =
    ctx.currentAge ??
    (ctx.birthYear != null ? calendarYear - ctx.birthYear : null)
  if (age == null || age < 18 || age > 100) return null

  const risk = normalizeRisk(ctx.riskTolerance)
  let stocks =
    risk === 'aggressive' ? 78 :
    risk === 'conservative' ? 38 :
    risk === 'balanced' ? 52 :
    62

  if (age >= 65) stocks -= 12
  else if (age >= 55) stocks -= 6
  if (age < 36) stocks += 5

  const dep = Math.min(ctx.dependents ?? 0, 4)
  const cash = Math.min(14, 5 + dep * 2)
  stocks = Math.round(Math.min(85, Math.max(25, stocks)))
  let bonds = 100 - stocks - cash
  if (bonds < 8) {
    bonds = 8
    stocks = Math.min(stocks, 100 - bonds - cash)
  }
  const s = Math.round(stocks)
  const b = Math.round(bonds)
  const c = 100 - s - b
  return { stocks: s, bonds: b, cash: c, age, risk, riskDisplay: riskLabel(risk) }
}

function householdHint(ctx: AssetAllocationContext): string | null {
  const parts: string[] = []
  if (ctx.hasSpouse || ctx.filingStatus === 'mfj' || ctx.maritalStatus?.toLowerCase() === 'married') {
    parts.push('household')
  }
  const dep = ctx.dependents
  if (dep != null && dep > 0) {
    parts.push(dep === 1 ? '1 dependent' : `${dep} dependents`)
  }
  if (parts.length === 0) return null
  return parts.join(' · ')
}

export function AssetAllocationSummary({ context }: Props) {
  const year = new Date().getFullYear()
  const mix = computeMix(context, year)
  const hint = householdHint(context)

  if (mix == null) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl" aria-hidden>📐</span>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Asset Allocation Recommendations</h2>
            <p className="text-xs text-neutral-500 mt-0.5">A quick, personalized mix based on your profile</p>
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center">
          <p className="text-3xl mb-2" aria-hidden>📝</p>
          <p className="text-sm font-medium text-neutral-800 mb-1">Complete your profile to see a recommendation</p>
          <p className="text-xs text-neutral-500 mb-4">
            Add your age (or birth year) and risk preferences so we can suggest a starter stocks / bonds / cash mix.
          </p>
          <Link
            href="/profile"
            className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 transition"
          >
            Go to profile →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden>📐</span>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Asset Allocation Recommendations</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Illustrative mix — not investment advice</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-neutral-600 mb-4">
        <span className="font-medium text-neutral-800">Based on your profile:</span>{' '}
        age {mix.age}
        {context.retirementAge != null ? ` · targeting retirement ~${context.retirementAge}` : ''}
        {` · ${mix.riskDisplay} risk`}
        {hint ? ` · ${hint}` : ''}
      </p>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-3 text-center">
          <p className="text-lg mb-1" aria-hidden>📈</p>
          <p className="text-xl font-bold text-neutral-900">{mix.stocks}%</p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">Stocks</p>
        </div>
        <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-3 text-center">
          <p className="text-lg mb-1" aria-hidden>📜</p>
          <p className="text-xl font-bold text-neutral-900">{mix.bonds}%</p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">Bonds</p>
        </div>
        <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-3 text-center">
          <p className="text-lg mb-1" aria-hidden>💵</p>
          <p className="text-xl font-bold text-neutral-900">{mix.cash}%</p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">Cash</p>
        </div>
      </div>

      <div className="w-full bg-neutral-100 rounded-full h-2.5 overflow-hidden flex mb-4">
        <div className="h-full bg-emerald-500" style={{ width: `${mix.stocks}%` }} title="Stocks" />
        <div className="h-full bg-amber-400" style={{ width: `${mix.bonds}%` }} title="Bonds" />
        <div className="h-full bg-slate-300" style={{ width: `${mix.cash}%` }} title="Cash" />
      </div>

      <p className="text-xs text-neutral-500 mb-3">
        This is a simple rule-of-thumb teaser. Your actual allocation should reflect goals, timeline, and comfort with volatility.
      </p>

      <Link
        href="/allocation"
        className="text-xs font-medium text-indigo-600 hover:underline"
      >
        Open asset allocation →
      </Link>
    </div>
  )
}
