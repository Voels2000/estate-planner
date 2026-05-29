'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { formatCurrency } from '@/lib/insurance'
import type { YearlyDataPoint } from '@/lib/monte-carlo'

export type MonteCarloSavedRun = {
  id: string
  label?: string
  retirement_age: number
  percentile_10: YearlyDataPoint[]
  percentile_25: YearlyDataPoint[]
  percentile_50: YearlyDataPoint[]
  percentile_75: YearlyDataPoint[]
  percentile_90: YearlyDataPoint[]
}

export function FanChart({ run }: { run: MonteCarloSavedRun }) {
  const data = run.percentile_50.map((pt, i) => ({
    age: pt.age,
    p10: run.percentile_10[i]?.balance ?? 0,
    p25: run.percentile_25[i]?.balance ?? 0,
    p50: run.percentile_50[i]?.balance ?? 0,
    p75: run.percentile_75[i]?.balance ?? 0,
    p90: run.percentile_90[i]?.balance ?? 0,
  }))
  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
        <defs>
          <linearGradient id="g90" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
          </linearGradient>
          <linearGradient id="g50" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="age" label={{ value: 'Age', position: 'insideBottom', offset: -2 }} tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} width={70} />
        <Tooltip formatter={(v, name) => [formatCurrency(Number(v ?? 0)), name as string]} labelFormatter={(l) => `Age ${l}`} />
        <ReferenceLine x={run.retirement_age} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Retirement', fontSize: 11, fill: '#94a3b8' }} />
        <Area type="monotone" dataKey="p90" stroke="#a5b4fc" fill="url(#g90)" strokeWidth={1} name="90th pct" />
        <Area type="monotone" dataKey="p75" stroke="#818cf8" fill="none" strokeWidth={1} name="75th pct" />
        <Area type="monotone" dataKey="p50" stroke="#6366f1" fill="url(#g50)" strokeWidth={2} name="Median" />
        <Area type="monotone" dataKey="p25" stroke="#4f46e5" fill="none" strokeWidth={1} name="25th pct" strokeDasharray="3 3" />
        <Area type="monotone" dataKey="p10" stroke="#3730a3" fill="none" strokeWidth={1} name="10th pct" strokeDasharray="3 3" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function CompareMedianChart({ runA, runB }: { runA: MonteCarloSavedRun; runB: MonteCarloSavedRun }) {
  const dataA = new Map(runA.percentile_50.map((pt) => [pt.age, pt.balance]))
  const dataB = new Map(runB.percentile_50.map((pt) => [pt.age, pt.balance]))
  const allAges = [...runA.percentile_50.map((p) => p.age), ...runB.percentile_50.map((p) => p.age)]
  const ages = Array.from(new Set(allAges)).sort((a, b) => a - b)
  const data = ages.map((age) => ({ age, runA: dataA.get(age) ?? null, runB: dataB.get(age) ?? null }))
  const labelA = runA.label || 'Run A'
  const labelB = runB.label || 'Run B'
  return (
    <div>
      <div className="flex gap-6 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-[var(--mwm-navy)] inline-block rounded" />{labelA} median</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-amber-500 inline-block rounded" />{labelB} median</span>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
          <defs>
            <linearGradient id="cgA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="cgB" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="age" tick={{ fontSize: 11 }} label={{ value: 'Age', position: 'insideBottom', offset: -2 }} />
          <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} width={70} />
          <Tooltip formatter={(v, name) => [formatCurrency(Number(v ?? 0)), name === 'runA' ? labelA : labelB]} labelFormatter={(l) => `Age ${l}`} />
          <ReferenceLine x={runA.retirement_age} stroke="#6366f1" strokeDasharray="4 4" strokeOpacity={0.5} />
          {runB.retirement_age !== runA.retirement_age && (
            <ReferenceLine x={runB.retirement_age} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.5} />
          )}
          <Area type="monotone" dataKey="runA" stroke="#6366f1" fill="url(#cgA)" strokeWidth={2} dot={false} connectNulls />
          <Area type="monotone" dataKey="runB" stroke="#f59e0b" fill="url(#cgB)" strokeWidth={2} dot={false} connectNulls />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
