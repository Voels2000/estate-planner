'use client'

import { useMemo, useState } from 'react'

type FunnelEvent = {
  event_name: string
  event_slug: string | null
  referral_code: string | null
  created_at: string
  properties: Record<string, unknown> | null
}

type SlugRow = {
  event_slug: string | null
  event_name: string
}

type ReferralRow = {
  referral_code: string | null
  event_name: string
}

type Props = {
  funnelBySlug: SlugRow[]
  funnelByReferral: ReferralRow[]
  recentFunnelEvents: FunnelEvent[]
}

const FUNNEL_STEPS = [
  { name: 'event_page_view', label: 'Event Page View', color: '#6366f1' },
  { name: 'event_assess_start', label: 'Assessment Started', color: '#8b5cf6' },
  { name: 'event_assess_complete', label: 'Assessment Completed', color: '#a855f7' },
  { name: 'email_captured', label: 'Email Captured', color: '#c9a84c' },
  { name: 'account_created', label: 'Account Created', color: '#10b981' },
  { name: 'tier_upgraded', label: 'Tier Upgraded', color: '#0f1f3d' },
  { name: 'advisor_connected', label: 'Advisor Connected', color: '#4a7c6f' },
]

function fmt(n: number) {
  return n.toLocaleString()
}

function pct(num: number, den: number) {
  if (den === 0) return '—'
  return `${Math.round((num / den) * 100)}%`
}

export function FunnelTab({ funnelBySlug, funnelByReferral, recentFunnelEvents }: Props) {
  const [detailTab, setDetailTab] = useState<'slug' | 'referral' | 'feed'>('slug')

  const stepCounts = useMemo(() => {
    const allCounts: Record<string, number> = {}
    for (const step of FUNNEL_STEPS) allCounts[step.name] = 0
    for (const e of recentFunnelEvents) {
      if (e.event_name in allCounts) allCounts[e.event_name]++
    }
    return allCounts
  }, [recentFunnelEvents])

  const topCount = Math.max(1, stepCounts['event_page_view'] ?? 1)

  const bySlug = useMemo(() => {
    const map = new Map<string, Record<string, number>>()
    const allEvents = [
      ...funnelBySlug.map(e => ({ slug: e.event_slug ?? 'unknown', name: e.event_name })),
      ...recentFunnelEvents
        .filter(e => e.event_slug)
        .map(e => ({ slug: e.event_slug!, name: e.event_name })),
    ]
    for (const e of allEvents) {
      if (!map.has(e.slug)) map.set(e.slug, {})
      const m = map.get(e.slug)!
      m[e.name] = (m[e.name] ?? 0) + 1
    }
    return Array.from(map.entries())
      .map(([slug, counts]) => ({ slug, counts }))
      .sort((a, b) => (b.counts['event_page_view'] ?? 0) - (a.counts['event_page_view'] ?? 0))
  }, [funnelBySlug, recentFunnelEvents])

  const byReferral = useMemo(() => {
    const map = new Map<string, Record<string, number>>()
    const allEvents = [
      ...funnelByReferral.map(e => ({ code: e.referral_code ?? 'unknown', name: e.event_name })),
      ...recentFunnelEvents
        .filter(e => e.referral_code)
        .map(e => ({ code: e.referral_code!, name: e.event_name })),
    ]
    for (const e of allEvents) {
      if (!map.has(e.code)) map.set(e.code, {})
      const m = map.get(e.code)!
      m[e.name] = (m[e.name] ?? 0) + 1
    }
    return Array.from(map.entries())
      .map(([code, counts]) => ({ code, counts }))
      .sort((a, b) => (b.counts['account_created'] ?? 0) - (a.counts['account_created'] ?? 0))
  }, [funnelByReferral, recentFunnelEvents])

  const views = stepCounts['event_page_view'] ?? 0
  const assessStarts = stepCounts['event_assess_start'] ?? 0
  const assessComplete = stepCounts['event_assess_complete'] ?? 0
  const emails = stepCounts['email_captured'] ?? 0
  const accounts = stepCounts['account_created'] ?? 0
  const upgrades = stepCounts['tier_upgraded'] ?? 0

  return (
    <div className="space-y-8">

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-1">
          Conversion Funnel
        </h2>
        <p className="text-xs text-neutral-400 mb-4">
          Last 50 events captured · Drop-off rates between steps
        </p>
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <div className="space-y-3">
            {FUNNEL_STEPS.map((step, i) => {
              const count = stepCounts[step.name] ?? 0
              const barWidth = topCount > 0 ? (count / topCount) * 100 : 0
              const prevStep = i > 0 ? FUNNEL_STEPS[i - 1] : null
              const prevCount = prevStep ? (stepCounts[prevStep.name] ?? 0) : count
              const dropOff = prevStep && prevCount > 0
                ? Math.round((1 - count / prevCount) * 100)
                : null

              return (
                <div key={step.name}>
                  {dropOff !== null && dropOff > 0 && (
                    <div className="flex items-center gap-2 py-1 pl-2">
                      <div className="w-2 h-4 border-l-2 border-dashed border-neutral-200" />
                      <span className="text-xs text-red-400 font-medium">
                        −{dropOff}% drop-off
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="w-40 shrink-0">
                      <p className="text-xs font-medium text-neutral-700 truncate">
                        {step.label}
                      </p>
                      <p className="text-xs text-neutral-400 font-mono">{step.name}</p>
                    </div>
                    <div className="flex-1 relative">
                      <div className="h-8 bg-neutral-50 rounded-lg overflow-hidden">
                        <div
                          className="h-full rounded-lg transition-all duration-500"
                          style={{
                            width: `${barWidth}%`,
                            background: step.color,
                            opacity: 0.85,
                          }}
                        />
                      </div>
                    </div>
                    <div className="w-16 text-right shrink-0">
                      <p className="text-sm font-bold text-neutral-900">{fmt(count)}</p>
                      {i > 0 && (
                        <p className="text-xs text-neutral-400">
                          {pct(count, topCount)} of top
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6 pt-6 border-t border-neutral-100 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'View → Assess', value: pct(assessStarts, views) },
              { label: 'Assess → Complete', value: pct(assessComplete, assessStarts) },
              { label: 'Complete → Account', value: pct(accounts, assessComplete) },
              { label: 'Account → Upgrade', value: pct(upgrades, accounts) },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <p className="text-xs text-neutral-500 mb-1">{stat.label}</p>
                <p className="text-xl font-bold text-neutral-900">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="flex gap-2 mb-4">
          {[
            { key: 'slug' as const, label: 'By Event Page' },
            { key: 'referral' as const, label: 'By Referral Code' },
            { key: 'feed' as const, label: 'Recent Events' },
          ].map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setDetailTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                detailTab === t.key
                  ? 'bg-neutral-900 text-white'
                  : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {detailTab === 'slug' && (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100">
              <h3 className="text-sm font-semibold text-neutral-900">Conversion by Event Page</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Which event pages drive the most assessments and accounts (last 30 days)
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-100">
                <thead className="bg-neutral-50">
                  <tr>
                    {['Event Slug', 'Page Views', 'Assess Start', 'Assess Complete', 'Email', 'Account', 'Upgrade', 'View→Account'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {bySlug.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-neutral-400">
                        No slug data yet — event pages need traffic
                      </td>
                    </tr>
                  ) : bySlug.map(({ slug, counts }) => (
                    <tr key={slug} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 text-xs font-mono text-neutral-700 max-w-[200px] truncate">
                        {slug}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-900 font-medium">
                        {fmt(counts['event_page_view'] ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {fmt(counts['event_assess_start'] ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {fmt(counts['event_assess_complete'] ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {fmt(counts['email_captured'] ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-700 font-medium">
                        {fmt(counts['account_created'] ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-indigo-700 font-medium">
                        {fmt(counts['tier_upgraded'] ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-neutral-900">
                        {pct(counts['account_created'] ?? 0, counts['event_page_view'] ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {detailTab === 'referral' && (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100">
              <h3 className="text-sm font-semibold text-neutral-900">Conversion by Referral Code</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Which advisor referral codes are driving conversions (last 30 days)
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-100">
                <thead className="bg-neutral-50">
                  <tr>
                    {['Referral Code', 'Page Views', 'Accounts', 'Upgrades', 'View→Account'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {byReferral.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-neutral-400">
                        No referral traffic yet — share advisor referral links to see data here
                      </td>
                    </tr>
                  ) : byReferral.map(({ code, counts }) => (
                    <tr key={code} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 text-xs font-mono font-semibold text-indigo-700">
                        {code}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-900 font-medium">
                        {fmt(counts['event_page_view'] ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-700 font-medium">
                        {fmt(counts['account_created'] ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-indigo-700 font-medium">
                        {fmt(counts['tier_upgraded'] ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-neutral-900">
                        {pct(counts['account_created'] ?? 0, counts['event_page_view'] ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {detailTab === 'feed' && (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100">
              <h3 className="text-sm font-semibold text-neutral-900">Recent Funnel Events</h3>
              <p className="text-xs text-neutral-400 mt-0.5">Last 50 events across all steps</p>
            </div>
            <div className="divide-y divide-neutral-100">
              {recentFunnelEvents.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-neutral-400">
                  No funnel events captured yet
                </div>
              ) : recentFunnelEvents.map((e, i) => {
                const step = FUNNEL_STEPS.find(s => s.name === e.event_name)
                return (
                  <div key={i} className="flex items-center gap-4 px-6 py-3 hover:bg-neutral-50">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: step?.color ?? '#e2e8f0' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-neutral-800">
                        {step?.label ?? e.event_name}
                      </p>
                      {e.event_slug && (
                        <p className="text-xs text-neutral-400 font-mono truncate">
                          {e.event_slug}
                          {e.referral_code && (
                            <span className="ml-2 text-indigo-500">ref:{e.referral_code}</span>
                          )}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 shrink-0">
                      {new Date(e.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-4">
          Weekly Review Queries
        </h2>
        <div className="bg-neutral-900 rounded-2xl p-5 space-y-4">
          <p className="text-xs text-neutral-400 mb-2">
            Run these in Supabase SQL editor for deeper analysis
          </p>
          {[
            {
              label: 'Funnel conversion rates (last 30 days)',
              sql: `select
  event_name,
  count(*) as total,
  count(distinct session_id) as sessions
from funnel_events
where created_at >= now() - interval '30 days'
group by event_name
order by total desc;`,
            },
            {
              label: 'Top converting event pages',
              sql: `select
  event_slug,
  count(*) filter (where event_name = 'event_page_view') as views,
  count(*) filter (where event_name = 'account_created') as accounts,
  round(
    count(*) filter (where event_name = 'account_created')::numeric /
    nullif(count(*) filter (where event_name = 'event_page_view'), 0) * 100, 1
  ) as conversion_pct
from funnel_events
where created_at >= now() - interval '30 days'
  and event_slug is not null
group by event_slug
order by accounts desc;`,
            },
            {
              label: 'Referral code performance',
              sql: `select
  r.referral_code,
  count(distinct r.id) as clicks,
  count(distinct f.session_id) filter (
    where f.event_name = 'account_created'
  ) as accounts
from referral_clicks r
left join funnel_events f using (referral_code)
group by r.referral_code
order by accounts desc;`,
            },
          ].map(q => (
            <div key={q.label}>
              <p className="text-xs font-semibold text-neutral-400 mb-2">{q.label}</p>
              <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap leading-relaxed bg-black/30 rounded-lg p-3 overflow-x-auto">
                {q.sql}
              </pre>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
