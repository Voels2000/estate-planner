'use client'

import Link from 'next/link'
import { useMemo, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export default function AllocationClient({ userTier }: { userTier: number }) {
  const [stocks, setStocks] = useState(60)
  const [bonds, setBonds] = useState(30)
  const [cash, setCash] = useState(10)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('households')
        .select('target_stocks_pct, target_bonds_pct, target_cash_pct')
        .eq('owner_id', user.id)
        .single()
      if (data?.target_stocks_pct != null) setStocks(data.target_stocks_pct)
      if (data?.target_bonds_pct  != null) setBonds(data.target_bonds_pct)
      if (data?.target_cash_pct   != null) setCash(data.target_cash_pct)
    }
    load()
  }, [])

  async function handleSave() {
    if (!valid) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    await supabase
      .from('households')
      .update({ target_stocks_pct: stocks, target_bonds_pct: bonds, target_cash_pct: cash })
      .eq('owner_id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const total = stocks + bonds + cash
  const valid = Math.abs(total - 100) < 0.01

  const bar = useMemo(
    () => [
      { key: 'stocks', pct: stocks, color: 'bg-indigo-600', label: 'Stocks' },
      { key: 'bonds', pct: bonds, color: 'bg-sky-500', label: 'Bonds' },
      { key: 'cash', pct: cash, color: 'bg-emerald-500', label: 'Cash' },
    ],
    [stocks, bonds, cash],
  )

  function normalize() {
    if (total <= 0) return
    const sf = (stocks / total) * 100
    const bf = (bonds / total) * 100
    const s = Math.round(sf)
    const b = Math.round(bf)
    const c = 100 - s - b
    setStocks(s)
    setBonds(b)
    setCash(c)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Asset allocation</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Set a target mix for your investable portfolio. Percentages should add up to 100%. Use this as a planning anchor; your actual holdings may differ by account or tax location.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Target mix</p>
          <div className="mt-3 flex h-4 w-full overflow-hidden rounded-full bg-neutral-100">
            {bar.map(({ key, pct, color }) =>
              pct > 0 ? (
                <div
                  key={key}
                  className={`${color} transition-all duration-300`}
                  style={{ width: `${clamp(pct, 0, 100)}%` }}
                  title={`${key}: ${pct}%`}
                />
              ) : null,
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-600">
            {bar.map(({ key, pct, color, label }) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${color}`} />
                {label}: <span className="font-medium tabular-nums text-neutral-900">{pct}%</span>
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ['Stocks', stocks, setStocks] as const,
              ['Bonds', bonds, setBonds] as const,
              ['Cash', cash, setCash] as const,
            ]
          ).map(([label, value, set]) => (
            <label key={label} className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-700">{label} %</span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={value}
                onChange={(e) => set(clamp(Number(e.target.value) || 0, 0, 100))}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm tabular-nums focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4">
          <span
            className={`text-sm font-medium tabular-nums ${valid ? 'text-green-600' : 'text-amber-600'}`}
          >
            Total: {total}%
            {!valid && ' — adjust or normalize to reach 100%'}
          </span>
          <button
            type="button"
      onClick={normalize}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Scale to 100%
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!valid || saving}
            className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Target Mix'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-5 text-sm text-neutral-700 space-y-3">
        <p>
          Many investors shift gradually toward more bonds and cash as they approach retirement (a &ldquo;glide path&rdquo;). Rules of thumb (e.g. &ldquo;age in bonds&rdquo;) are only starting points — your timeline, spending, and risk tolerance matter more.
        </p>
        {userTier >= 3 ? (
          <p>
            <Link href="/monte-carlo" className="font-medium text-indigo-700 underline-offset-2 hover:underline">
              Monte Carlo simulations
            </Link>{' '}
            use this same stock / bond / cash split in the portfolio step so you can stress-test outcomes.
          </p>
        ) : (
          <p className="text-neutral-600">
            Upgrade to the Estate plan to run Monte Carlo simulations that stress-test retirement outcomes using your allocation.
          </p>
        )}
      </div>
    </div>
  )
}
