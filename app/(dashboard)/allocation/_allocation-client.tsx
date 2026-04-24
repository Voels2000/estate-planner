'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Benchmark { stocks: number; bonds: number; cash: number }
interface AllocationData {
  person1_first_name: string | null
  age: number | null
  risk: string
  retirement_year: number | null
  years_to_retirement: number | null
  total_portfolio: number
  annual_spending: number
  withdrawal_rate: number | null
  current_amounts: { stocks: number; bonds: number; cash: number; other: number }
  current_pct: { stocks: number; bonds: number; cash: number; other: number }
  target_mix: Benchmark | null
  target_mix_source: string
  recommended: Benchmark | null
  drift: { stocks: number; bonds: number; cash: number } | null
  rebalance: { stocks: number; bonds: number; cash: number } | null
  benchmarks: { age_based: Benchmark | null; risk_based: Benchmark; target_date: Benchmark | null }
  breakdown: { name: string; type: string; value: number; asset_class: string; pct: number }[]
  has_assets: boolean
}

const COLORS: Record<string, string> = {
  stocks: '#6366f1',
  bonds:  '#22d3ee',
  cash:   '#34d399',
  other:  '#a78bfa',
}

function clamp(n: number, min: number, max: number) { return Math.min(max, Math.max(min, n)) }
const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`
const fmtFull = (n: number) => '$' + Math.round(n).toLocaleString()
const driftColor = (d: number) => Math.abs(d) <= 3 ? 'text-green-600' : Math.abs(d) <= 8 ? 'text-yellow-600' : 'text-red-600'
const driftLabel = (d: number) => Math.abs(d) <= 3 ? 'On target' : d > 0 ? `+${d}% over` : `${d}% under`

function DonutChart({ data }: { data: { label: string; pct: number; color: string }[] }) {
  const size = 160; const cx = size / 2; const cy = size / 2; const r = 62; const inner = 38
  const slices = data
    .filter(d => d.pct > 0)
    .reduce<Array<{ label: string; pct: number; color: string; start: number; end: number }>>((acc, d) => {
      const start = acc.length > 0 ? acc[acc.length - 1].end : 0
      const end = start + d.pct
      acc.push({ ...d, start, end })
      return acc
    }, [])
  function arc(startPct: number, endPct: number) {
    const s = (startPct / 100) * 2 * Math.PI - Math.PI / 2
    const e = (endPct   / 100) * 2 * Math.PI - Math.PI / 2
    const x1 = cx + r * Math.cos(s); const y1 = cy + r * Math.sin(s)
    const x2 = cx + r * Math.cos(e); const y2 = cy + r * Math.sin(e)
    const xi1 = cx + inner * Math.cos(s); const yi1 = cy + inner * Math.sin(s)
    const xi2 = cx + inner * Math.cos(e); const yi2 = cy + inner * Math.sin(e)
    const large = (endPct - startPct) > 50 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1} Z`
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s, i) => <path key={i} d={arc(s.start, s.end)} fill={s.color} opacity={0.9} />)}
      <circle cx={cx} cy={cy} r={inner - 2} fill="white" />
    </svg>
  )
}

function BenchmarkCard({ title, subtitle, mix, highlight }: {
  title: string; subtitle: string; mix: Benchmark; highlight?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${highlight ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
      <div>
        <p className={`text-sm font-semibold ${highlight ? 'text-indigo-900' : 'text-gray-800'}`}>{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="bg-indigo-500 h-full transition-all" style={{ width: `${mix.stocks}%` }} />
        <div className="bg-cyan-400 h-full transition-all"  style={{ width: `${mix.bonds}%`  }} />
        <div className="bg-emerald-400 h-full transition-all" style={{ width: `${mix.cash}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        {[['Stocks', mix.stocks, 'text-indigo-700'], ['Bonds', mix.bonds, 'text-cyan-700'], ['Cash', mix.cash, 'text-emerald-700']].map(([label, val, color]) => (
          <div key={label as string}>
            <p className={`text-sm font-bold ${color}`}>{val}%</p>
            <p className="text-xs text-gray-400">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function BarRow({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const drift = current - target
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className={`text-xs font-medium ${driftColor(drift)}`}>{driftLabel(drift)}</span>
      </div>
      <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
        <div className="absolute top-0 bottom-0 w-0.5 bg-gray-400 z-10" style={{ left: `${target}%` }} />
        <div className="absolute top-1 bottom-1 rounded-full transition-all duration-500"
          style={{ width: `${current}%`, backgroundColor: color, opacity: 0.85 }} />
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-0.5">
        <span>Current: {current}%</span>
        <span>Target: {target}%</span>
      </div>
    </div>
  )
}

export default function AllocationClient({ userTier: _userTier }: { userTier: number }) {
  void _userTier
  const [data, setData] = useState<AllocationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Target mix sliders
  const [stocks, setStocks] = useState(60)
  const [bonds,  setBonds]  = useState(30)
  const [cash,   setCash]   = useState(10)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const total = stocks + bonds + cash
  const valid = Math.abs(total - 100) < 0.01

  useEffect(() => {
    // Load allocation data and saved target mix in parallel
    Promise.all([
      fetch('/api/asset-allocation').then(r => r.json()),
      createClient().auth.getUser().then(({ data: { user } }) => {
        if (!user) return null
        return createClient()
          .from('households')
          .select('target_stocks_pct, target_bonds_pct, target_cash_pct')
          .eq('owner_id', user.id)
          .single()
          .then(({ data }) => data)
      })
    ]).then(([allocData, targetData]) => {
      if (allocData.error) { setError(allocData.error); setLoading(false); return }
      setData(allocData)
      if (targetData?.target_stocks_pct != null) {
        setStocks(targetData.target_stocks_pct)
        setBonds(targetData.target_bonds_pct ?? 30)
        setCash(targetData.target_cash_pct ?? 10)
      }
      setLoading(false)
    }).catch(() => { setError('Failed to load data'); setLoading(false) })
  }, [])

  function normalize() {
    if (total <= 0) return
    const s = Math.round((stocks / total) * 100)
    const b = Math.round((bonds  / total) * 100)
    const c = 100 - s - b
    setStocks(s); setBonds(b); setCash(c)
  }

  async function handleSave() {
    if (!valid) return
    setSaving(true); setSaveError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSaveError('Not logged in'); return }
      const { error } = await supabase
        .from('households')
        .update({ target_stocks_pct: stocks, target_bonds_pct: bonds, target_cash_pct: cash })
        .eq('owner_id', user.id)
      if (error) { setSaveError(error.message); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      // Refresh allocation data so drift bars update immediately
      const fresh = await fetch('/api/asset-allocation').then(r => r.json())
      if (!fresh.error) setData(fresh)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>
  if (error)   return <div className="max-w-2xl mx-auto mt-10 p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>

  const riskLabel = data ? (data.risk.charAt(0).toUpperCase() + data.risk.slice(1)) : 'Moderate'
  const name = data?.person1_first_name ?? 'Your'

  // Use saved target for drift display, fall back to data.recommended
  const displayTarget = valid ? { stocks, bonds, cash } : (data?.recommended ?? null)
  const displayRebalance = (data && displayTarget && data.total_portfolio > 0) ? {
    stocks: Math.round((displayTarget.stocks / 100) * data.total_portfolio) - data.current_amounts.stocks,
    bonds:  Math.round((displayTarget.bonds  / 100) * data.total_portfolio) - data.current_amounts.bonds,
    cash:   Math.round((displayTarget.cash   / 100) * data.total_portfolio) - data.current_amounts.cash,
  } : null

  const donutData = data ? [
    { label: 'Stocks', pct: data.current_pct.stocks, color: COLORS.stocks },
    { label: 'Bonds',  pct: data.current_pct.bonds,  color: COLORS.bonds  },
    { label: 'Cash',   pct: data.current_pct.cash,   color: COLORS.cash   },
    { label: 'Other',  pct: data.current_pct.other,  color: COLORS.other  },
  ] : []

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Asset Allocation</h1>
        <p className="text-sm text-gray-500 mt-1">
          {name}&apos;s portfolio · {riskLabel} risk
          {data?.age ? `, age ${data.age}` : ''}
          {data?.years_to_retirement != null ? ` · ${data.years_to_retirement} years to retirement` : ''}
        </p>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Portfolio', value: fmt(data.total_portfolio) },
            { label: 'Annual Spending', value: data.annual_spending > 0 ? fmt(data.annual_spending) : '—' },
            { label: 'Withdrawal Rate', value: data.withdrawal_rate ? `${data.withdrawal_rate}%` : '—' },
            { label: 'Risk Profile',    value: riskLabel },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">{c.label}</p>
              <p className="text-xl font-bold text-gray-900">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Section 1 — Benchmark Models */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Industry Benchmarks</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {data?.benchmarks.age_based && (
            <BenchmarkCard
              title="Age-Based Glide Path"
              subtitle={`120 minus age rule · age ${data.age}`}
              mix={data.benchmarks.age_based}
            />
          )}
          <BenchmarkCard
            title="Risk-Based Model"
            subtitle={`${riskLabel} risk profile · Vanguard-style`}
            mix={data?.benchmarks.risk_based ?? { stocks: 60, bonds: 35, cash: 5 }}
          />
          {data?.benchmarks.target_date && (
            <BenchmarkCard
              title="Target Date Fund"
              subtitle={`${data.years_to_retirement}yr to retirement · Vanguard TDF`}
              mix={data.benchmarks.target_date}
            />
          )}
        </div>
      </div>

      {/* Section 2 — Your Target Mix */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Your Target Mix</h2>
          <p className="text-xs text-gray-400 mt-0.5">Set your own target and save it — this drives your drift analysis and Monte Carlo simulations below.</p>
        </div>

        {/* Visual bar */}
        <div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="bg-indigo-500 h-full transition-all" style={{ width: `${clamp(stocks, 0, 100)}%` }} />
            <div className="bg-cyan-400 h-full transition-all"   style={{ width: `${clamp(bonds,  0, 100)}%` }} />
            <div className="bg-emerald-400 h-full transition-all" style={{ width: `${clamp(cash, 0, 100)}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
            {[['Stocks', stocks, 'bg-indigo-500'], ['Bonds', bonds, 'bg-cyan-400'], ['Cash', cash, 'bg-emerald-400']].map(([label, pct, color]) => (
              <span key={label as string} className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${color}`} />
                {label}: <span className="font-medium text-gray-900">{pct}%</span>
              </span>
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div className="grid gap-4 sm:grid-cols-3">
          {([['Stocks', stocks, setStocks], ['Bonds', bonds, setBonds], ['Cash', cash, setCash]] as const).map(([label, value, set]) => (
            <label key={label} className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-700">{label} %</span>
              <input type="number" min={0} max={100} step={1} value={value}
                onChange={e => set(clamp(Number(e.target.value) || 0, 0, 100))}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
              />
            </label>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
          <span className={`text-sm font-medium tabular-nums ${valid ? 'text-green-600' : 'text-amber-600'}`}>
            Total: {total}%{!valid && ' — must equal 100%'}
          </span>
          <button type="button" onClick={normalize}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Scale to 100%
          </button>
          <button type="button" onClick={handleSave} disabled={!valid || saving}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Target Mix'}
          </button>
          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
        </div>

        {/* Quick-set from benchmarks */}
        {data?.benchmarks && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400 mb-2">Quick-set from benchmark:</p>
            <div className="flex flex-wrap gap-2">
              {data.benchmarks.age_based && (
                <button type="button"
                  onClick={() => { setStocks(data.benchmarks.age_based!.stocks); setBonds(data.benchmarks.age_based!.bonds); setCash(data.benchmarks.age_based!.cash) }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
                  Use Age-Based
                </button>
              )}
              <button type="button"
                onClick={() => { setStocks(data.benchmarks.risk_based.stocks); setBonds(data.benchmarks.risk_based.bonds); setCash(data.benchmarks.risk_based.cash) }}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
                Use Risk-Based
              </button>
              {data.benchmarks.target_date && (
                <button type="button"
                  onClick={() => { setStocks(data.benchmarks.target_date!.stocks); setBonds(data.benchmarks.target_date!.bonds); setCash(data.benchmarks.target_date!.cash) }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
                  Use Target Date
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section 3 — Actual Holdings vs Target */}
      {data?.has_assets ? (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Donut */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Current Allocation</h2>
              <div className="flex items-center gap-6">
                <DonutChart data={donutData} />
                <div className="space-y-2">
                  {donutData.filter(d => d.pct > 0).map(d => (
                    <div key={d.label} className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-gray-600">{d.label}</span>
                      <span className="font-semibold text-gray-900 ml-auto">{d.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Drift bars */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Actual vs Your Target</h2>
              <p className="text-xs text-gray-400 mb-4">Bar = current · Line = your saved target</p>
              {displayTarget ? (
                <>
                  <BarRow label="Stocks" current={data.current_pct.stocks} target={displayTarget.stocks} color={COLORS.stocks} />
                  <BarRow label="Bonds"  current={data.current_pct.bonds}  target={displayTarget.bonds}  color={COLORS.bonds}  />
                  <BarRow label="Cash"   current={data.current_pct.cash}   target={displayTarget.cash}   color={COLORS.cash}   />
                </>
              ) : (
                <p className="text-sm text-gray-400">Save a target mix above to see drift analysis.</p>
              )}
            </div>
          </div>

          {/* Rebalancing */}
          {displayRebalance && displayTarget && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Rebalancing Suggestions</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {(['stocks', 'bonds', 'cash'] as const).map(cls => {
                  const amt = displayRebalance[cls]
                  const action = amt > 0 ? 'Buy' : amt < 0 ? 'Sell' : 'Hold'
                  const bg = amt > 0 ? 'bg-indigo-50 border-indigo-200' : amt < 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                  const tc = amt > 0 ? 'text-indigo-700' : amt < 0 ? 'text-red-700' : 'text-green-700'
                  return (
                    <div key={cls} className={`rounded-lg border p-4 ${bg}`}>
                      <p className="text-xs text-gray-500 capitalize mb-1">{cls}</p>
                      <p className={`text-lg font-bold ${tc}`}>{action}</p>
                      <p className={`text-sm font-medium ${tc}`}>{amt === 0 ? 'No change needed' : fmtFull(Math.abs(amt))}</p>
                      <p className="text-xs text-gray-400 mt-1">Target: {displayTarget[cls]}% · Current: {data.current_pct[cls as keyof typeof data.current_pct]}%</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Asset breakdown table */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Asset Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                    <th className="pb-2 font-medium">Asset</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Class</th>
                    <th className="pb-2 font-medium text-right">Value</th>
                    <th className="pb-2 font-medium text-right">% of Portfolio</th>
                  </tr>
                </thead>
                <tbody>
                  {data.breakdown.map((a, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 font-medium text-gray-800">{a.name}</td>
                      <td className="py-2 text-gray-500 capitalize">{a.type}</td>
                      <td className="py-2">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white capitalize"
                          style={{ backgroundColor: COLORS[a.asset_class] ?? '#9ca3af' }}>
                          {a.asset_class}
                        </span>
                      </td>
                      <td className="py-2 text-right font-medium text-gray-800">{fmtFull(a.value)}</td>
                      <td className="py-2 text-right text-gray-500">{a.pct}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td colSpan={3} className="pt-2 text-xs font-semibold text-gray-500 uppercase">Total</td>
                    <td className="pt-2 text-right font-bold text-gray-900">{fmtFull(data.total_portfolio)}</td>
                    <td className="pt-2 text-right font-bold text-gray-900">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-sm text-yellow-800">
          No investable assets found. Add assets in your profile to see your allocation analysis.
        </div>
      )}
    </div>
  )
}
