'use client'

import { useEffect, useState } from 'react'

interface AllocationData {
  person1_first_name: string | null
  age: number | null
  risk: string
  total_portfolio: number
  annual_spending: number
  withdrawal_rate: number | null
  current_amounts: { stocks: number; bonds: number; cash: number; other: number }
  current_pct: { stocks: number; bonds: number; cash: number; other: number }
  recommended: { stocks: number; bonds: number; cash: number } | null
  drift: { stocks: number; bonds: number; cash: number } | null
  rebalance: { stocks: number; bonds: number; cash: number } | null
  breakdown: { name: string; type: string; value: number; asset_class: string; pct: number }[]
  has_assets: boolean
}

const fmt = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : `$${Math.round(n / 1000)}K`

const fmtFull = (n: number) =>
  '$' + Math.round(n).toLocaleString()

const driftColor = (d: number) =>
  Math.abs(d) <= 3 ? 'text-green-600' :
  Math.abs(d) <= 8 ? 'text-yellow-600' : 'text-red-600'

const driftLabel = (d: number) =>
  Math.abs(d) <= 3 ? 'On target' :
  d > 0 ? `+${d}% overweight` : `${d}% underweight`

const COLORS: Record<string, string> = {
  stocks: '#6366f1',
  bonds:  '#22d3ee',
  cash:   '#34d399',
  other:  '#a78bfa',
}

function DonutChart({ data }: { data: { label: string; pct: number; color: string }[] }) {
  const size = 180
  const cx = size / 2
  const cy = size / 2
  const r = 70
  const inner = 44

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
    const x1 = cx + r * Math.cos(s)
    const y1 = cy + r * Math.sin(s)
    const x2 = cx + r * Math.cos(e)
    const y2 = cy + r * Math.sin(e)
    const xi1 = cx + inner * Math.cos(s)
    const yi1 = cy + inner * Math.sin(s)
    const xi2 = cx + inner * Math.cos(e)
    const yi2 = cy + inner * Math.sin(e)
    const large = (endPct - startPct) > 50 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1} Z`
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s, i) => (
        <path key={i} d={arc(s.start, s.end)} fill={s.color} opacity={0.9} />
      ))}
      <circle cx={cx} cy={cy} r={inner - 2} fill="white" />
    </svg>
  )
}

function BarRow({ label, current, recommended, color }: {
  label: string; current: number; recommended: number; color: string
}) {
  const drift = current - recommended
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className={`text-xs font-medium ${driftColor(drift)}`}>{driftLabel(drift)}</span>
      </div>
      <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
        {/* Recommended marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-gray-400 z-10"
          style={{ left: `${recommended}%` }}
        />
        {/* Current bar */}
        <div
          className="absolute top-1 bottom-1 rounded-full transition-all duration-500"
          style={{ width: `${current}%`, backgroundColor: color, opacity: 0.85 }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-0.5">
        <span>Current: {current}%</span>
        <span>Target: {recommended}%</span>
      </div>
    </div>
  )
}

export default function AllocationClient() {
  const [data, setData] = useState<AllocationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/asset-allocation')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Failed to load allocation data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
      Loading allocation data…
    </div>
  )

  if (error) return (
    <div className="max-w-2xl mx-auto mt-10 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
      {error}
    </div>
  )

  if (!data) return null

  if (!data.has_assets) return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
      No investable assets found. Add assets in your profile to see your allocation analysis.
    </div>
  )

  const name = data.person1_first_name ?? 'Your'
  const riskLabel = data.risk.charAt(0).toUpperCase() + data.risk.slice(1)

  const donutData = [
    { label: 'Stocks', pct: data.current_pct.stocks, color: COLORS.stocks },
    { label: 'Bonds',  pct: data.current_pct.bonds,  color: COLORS.bonds  },
    { label: 'Cash',   pct: data.current_pct.cash,   color: COLORS.cash   },
    { label: 'Other',  pct: data.current_pct.other,  color: COLORS.other  },
  ]

  const withdrawalStatus =
    !data.withdrawal_rate ? null :
    data.withdrawal_rate <= 3.5 ? { label: 'Conservative', color: 'text-green-600' } :
    data.withdrawal_rate <= 4.5 ? { label: 'Moderate',     color: 'text-yellow-600' } :
                                   { label: 'Elevated',     color: 'text-red-600' }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Asset Allocation</h1>
        <p className="text-sm text-gray-500 mt-1">
          {name}&apos;s portfolio review — {riskLabel} risk profile
          {data.age ? `, age ${data.age}` : ''}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Portfolio',   value: fmt(data.total_portfolio) },
          { label: 'Annual Spending',   value: data.annual_spending > 0 ? fmt(data.annual_spending) : '—' },
          { label: 'Withdrawal Rate',   value: data.withdrawal_rate ? `${data.withdrawal_rate}%` : '—',
            sub: withdrawalStatus?.label, subColor: withdrawalStatus?.color },
          { label: 'Risk Profile',      value: riskLabel },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className="text-xl font-bold text-gray-900">{c.value}</p>
            {c.sub && <p className={`text-xs font-medium mt-0.5 ${c.subColor}`}>{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Current allocation + drift */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* Donut chart */}
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
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Allocation vs Target
            {data.recommended && (
              <span className="text-xs font-normal text-gray-400 ml-2">
                (bar = current, line = target)
              </span>
            )}
          </h2>
          {data.recommended ? (
            <>
              <BarRow label="Stocks" current={data.current_pct.stocks} recommended={data.recommended.stocks} color={COLORS.stocks} />
              <BarRow label="Bonds"  current={data.current_pct.bonds}  recommended={data.recommended.bonds}  color={COLORS.bonds}  />
              <BarRow label="Cash"   current={data.current_pct.cash}   recommended={data.recommended.cash}   color={COLORS.cash}   />
            </>
          ) : (
            <p className="text-sm text-gray-400">Add your birth year to see target allocation.</p>
          )}
        </div>
      </div>

      {/* Rebalancing suggestions */}
      {data.rebalance && data.recommended && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Rebalancing Suggestions</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {(['stocks', 'bonds', 'cash'] as const).map(cls => {
              const amt = data.rebalance![cls]
              const action = amt > 0 ? 'Buy' : amt < 0 ? 'Sell' : 'Hold'
              const bg = amt > 0 ? 'bg-indigo-50 border-indigo-200' :
                         amt < 0 ? 'bg-red-50 border-red-200' :
                                   'bg-green-50 border-green-200'
              const tc = amt > 0 ? 'text-indigo-700' :
                         amt < 0 ? 'text-red-700' : 'text-green-700'
              return (
                <div key={cls} className={`rounded-lg border p-4 ${bg}`}>
                  <p className="text-xs text-gray-500 capitalize mb-1">{cls}</p>
                  <p className={`text-lg font-bold ${tc}`}>{action}</p>
                  <p className={`text-sm font-medium ${tc}`}>
                    {amt === 0 ? 'No change needed' : fmtFull(Math.abs(amt))}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Target: {data.recommended![cls]}% · Current: {data.current_pct[cls as keyof typeof data.current_pct]}%
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Plain language recommendation */}
      {data.recommended && data.drift && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-indigo-900 mb-2">Recommendation</h2>
          <p className="text-sm text-indigo-800 leading-relaxed">
            {(() => {
              const bigDrift = (['stocks', 'bonds', 'cash'] as const)
                .filter(c => Math.abs(data.drift![c]) > 8)
              if (bigDrift.length === 0) {
                return `Your portfolio is well-aligned with a ${riskLabel.toLowerCase()} allocation for age ${data.age}. No major rebalancing needed — review annually or after large market moves.`
              }
              const parts = bigDrift.map(c => {
                const d = data.drift![c]
                return `${d > 0 ? 'overweight' : 'underweight'} ${c} by ${Math.abs(d)}%`
              })
              return `Your portfolio is ${parts.join(' and ')}. Consider rebalancing toward your ${riskLabel.toLowerCase()} target. ${data.withdrawal_rate && data.withdrawal_rate > 4.5 ? `At a ${data.withdrawal_rate}% withdrawal rate, staying on target allocation helps manage sequence-of-returns risk.` : ''}`
            })()}
          </p>
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
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white capitalize"
                      style={{ backgroundColor: COLORS[a.asset_class] ?? '#9ca3af' }}
                    >
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

    </div>
  )
}