'use client'

import { useEffect, useState } from 'react'

interface ImpactData {
  clicks: number
  signups: number
  connected: number
  recentActivity: Array<{
    clicked_at: string
    event_slug: string | null
    source: string | null
  }>
  period: string
}

export function ReferralImpactPanel() {
  const [data, setData] = useState<ImpactData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/advisor/referral-impact')
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-5 animate-pulse">
        <div className="h-4 bg-neutral-100 rounded w-32 mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-neutral-100 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  const stats = [
    { label: 'Link clicks', value: data.clicks, sub: data.period },
    { label: 'New signups', value: data.signups, sub: 'attributed to you' },
    { label: 'Active clients', value: data.connected, sub: 'total connected' },
  ]

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden mb-6">
      <div className="px-5 pt-5 pb-4 border-b border-neutral-100">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Your referral impact
        </h2>
        <p className="text-xs text-neutral-400 mt-0.5">
          Households who visited via your links
        </p>
      </div>
      <div className="grid grid-cols-3 divide-x divide-neutral-100">
        {stats.map((s) => (
          <div key={s.label} className="px-5 py-4 text-center">
            <p className="text-2xl font-bold text-[#0F1B3C]">{s.value}</p>
            <p className="text-xs font-medium text-neutral-700 mt-0.5">{s.label}</p>
            <p className="text-xs text-neutral-400">{s.sub}</p>
          </div>
        ))}
      </div>
      {data.recentActivity.length > 0 && (
        <div className="px-5 pb-4 pt-3 border-t border-neutral-100">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
            Recent activity
          </p>
          <ul className="space-y-1.5">
            {data.recentActivity.map((a, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-neutral-600">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                <span>
                  {a.event_slug
                    ? `Visit from "${a.event_slug.replace(/-/g, ' ')}" page`
                    : 'Direct link visit'}
                </span>
                <span className="text-neutral-400 ml-auto">
                  {new Date(a.clicked_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.clicks === 0 && data.signups === 0 && (
        <div className="px-5 pb-4 pt-2">
          <p className="text-xs text-neutral-500">
            Share your referral links from the Newsletter Kit tab to start tracking activity.
          </p>
        </div>
      )}
    </div>
  )
}
