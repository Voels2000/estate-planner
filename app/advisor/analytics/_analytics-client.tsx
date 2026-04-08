// Sprint 62 — Book-of-Business Analytics client component
// 6 panels: health distribution, tax bands, stale docs, sunset opportunity,
// unplanned exposure, open conflicts. All sortable and exportable as CSV.

'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import type { BookOfBusinessData, ClientSummary, SunsetOpportunity } from '@/lib/analytics/bookOfBusiness'
import { fetchBookOfBusiness } from '@/lib/analytics/bookOfBusiness'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function exportCSV(data: ClientSummary[], filename: string) {
  const headers = ['Name', 'Email', 'Health Score', 'Gross Estate', 'Fed Tax', 'Alerts']
  const rows = data.map(c => [
    c.full_name,
    c.email,
    c.health_score ?? 'N/A',
    c.gross_estate ? fmt(c.gross_estate) : 'N/A',
    c.estate_tax_federal_current ? fmt(c.estate_tax_federal_current) : 'N/A',
    c.active_alert_count,
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────

function Panel({
  title,
  subtitle,
  children,
  onExport,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  onExport?: () => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
          {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
        </div>
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Export CSV
          </button>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ─── Panel 1: Health score distribution ──────────────────────────────────────

function HealthDistributionPanel({ data }: { data: BookOfBusinessData }) {
  const total = data.totalClients
  return (
    <Panel title="Health Score Distribution" subtitle="Clients by estate readiness band">
      <div className="space-y-3">
        {data.healthDistribution.map(band => (
          <div key={band.band}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-neutral-700">{band.label}</span>
              <span className="text-sm font-semibold text-neutral-900">{band.count}</span>
            </div>
            <div className="w-full bg-neutral-100 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: total > 0 ? `${(band.count / total) * 100}%` : '0%',
                  backgroundColor: band.color,
                }}
              />
            </div>
          </div>
        ))}
        {data.averageHealthScore !== null && (
          <div className="pt-2 border-t border-neutral-100">
            <span className="text-xs text-neutral-500">Average score: </span>
            <span className="text-sm font-semibold text-neutral-900">{data.averageHealthScore}/100</span>
          </div>
        )}
      </div>
    </Panel>
  )
}

// ─── Panel 2: Estate tax exposure bands ──────────────────────────────────────

function TaxBandsPanel({ data }: { data: BookOfBusinessData }) {
  return (
    <Panel title="Estate Tax Exposure" subtitle="Clients by projected federal estate tax">
      <div className="space-y-3">
        {data.taxBands.map(band => (
          <div key={band.band} className="flex items-center justify-between">
            <span className="text-sm text-neutral-700">{band.label}</span>
            <div className="flex items-center gap-3">
              <div className="w-24 bg-neutral-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-indigo-500 transition-all"
                  style={{
                    width: data.totalClients > 0
                      ? `${(band.count / data.totalClients) * 100}%`
                      : '0%',
                  }}
                />
              </div>
              <span className="text-sm font-semibold text-neutral-900 w-4 text-right">{band.count}</span>
            </div>
          </div>
        ))}
        <div className="pt-2 border-t border-neutral-100">
          <span className="text-xs text-neutral-500">Total projected exposure: </span>
          <span className="text-sm font-semibold text-neutral-900">{fmt(data.totalProjectedTax)}</span>
        </div>
      </div>
    </Panel>
  )
}

// ─── Panel 3: Stale document clients ─────────────────────────────────────────

function StaleDocumentsPanel({ data }: { data: BookOfBusinessData }) {
  return (
    <Panel
      title="Active Alerts"
      subtitle="Clients with unresolved planning alerts"
      onExport={() => exportCSV(data.staleDocumentClients, 'clients-with-alerts.csv')}
    >
      {data.staleDocumentClients.length === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-4">No clients with active alerts.</p>
      ) : (
        <div className="space-y-2">
          {data.staleDocumentClients.slice(0, 8).map(c => (
            <Link
              key={c.client_id}
              href={`/advisor/clients/${c.client_id}`}
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-neutral-50 transition"
            >
              <span className="text-sm font-medium text-neutral-800 truncate">{c.full_name}</span>
              <div className="flex items-center gap-2 shrink-0">
                {c.high_alert_count > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                    {c.high_alert_count} high
                  </span>
                )}
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                  {c.active_alert_count} total
                </span>
              </div>
            </Link>
          ))}
          {data.staleDocumentClients.length > 8 && (
            <p className="text-xs text-neutral-400 text-center pt-1">
              +{data.staleDocumentClients.length - 8} more
            </p>
          )}
        </div>
      )}
    </Panel>
  )
}

// ─── Panel 4: Sunset opportunity list ────────────────────────────────────────

function SunsetOpportunityPanel({ data }: { data: BookOfBusinessData }) {
  const exportSunset = () => {
    const headers = ['Name', 'Gross Estate', 'Tax (Current Law)', 'Tax (Sunset)', 'Delta']
    const rows = data.sunsetOpportunities.map((c: SunsetOpportunity) => [
      c.full_name,
      fmt(c.gross_estate),
      fmt(c.tax_current),
      fmt(c.tax_sunset),
      fmt(c.delta),
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sunset-opportunity-list.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Panel
      title="Sunset Opportunity List"
      subtitle="Clients with $500K+ additional tax under sunset scenario"
      onExport={exportSunset}
    >
      {data.sunsetOpportunities.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-neutral-400">No clients with significant sunset exposure yet.</p>
          <p className="text-xs text-neutral-300 mt-1">Run projections for clients to populate this list.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="text-left text-xs font-semibold text-neutral-500 pb-2">Client</th>
                <th className="text-right text-xs font-semibold text-neutral-500 pb-2">Current Tax</th>
                <th className="text-right text-xs font-semibold text-neutral-500 pb-2">Sunset Tax</th>
                <th className="text-right text-xs font-semibold text-neutral-500 pb-2">Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {data.sunsetOpportunities.map((c: SunsetOpportunity) => (
                <tr key={c.client_id} className="hover:bg-neutral-50">
                  <td className="py-2">
                    <Link
                      href={`/advisor/clients/${c.client_id}`}
                      className="font-medium text-neutral-800 hover:text-indigo-600"
                    >
                      {c.full_name}
                    </Link>
                  </td>
                  <td className="py-2 text-right text-neutral-700">{fmt(c.tax_current)}</td>
                  <td className="py-2 text-right text-amber-700">{fmt(c.tax_sunset)}</td>
                  <td className="py-2 text-right font-semibold text-red-600">{fmt(c.delta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

// ─── Panel 5: Unplanned exposure ──────────────────────────────────────────────

function UnplannedExposurePanel({ data }: { data: BookOfBusinessData }) {
  return (
    <Panel
      title="Unplanned Exposure"
      subtitle="$2M+ projected tax with no strategy implemented"
      onExport={() => exportCSV(data.unplannedExposureClients, 'unplanned-exposure.csv')}
    >
      {data.unplannedExposureClients.length === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-4">No clients with unplanned exposure.</p>
      ) : (
        <div className="space-y-2">
          {data.unplannedExposureClients.map(c => (
            <Link
              key={c.client_id}
              href={`/advisor/clients/${c.client_id}`}
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-neutral-50 transition"
            >
              <span className="text-sm font-medium text-neutral-800 truncate">{c.full_name}</span>
              <span className="text-sm font-semibold text-red-600 shrink-0">
                {fmt(c.estate_tax_federal_current ?? 0)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  )
}

// ─── Panel 6: Open conflict clients ──────────────────────────────────────────

function OpenConflictsPanel({ data }: { data: BookOfBusinessData }) {
  return (
    <Panel
      title="Open High-Priority Alerts"
      subtitle="Clients with unresolved high-severity alerts"
      onExport={() => exportCSV(data.openConflictClients, 'open-conflicts.csv')}
    >
      {data.openConflictClients.length === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-4">No clients with high-priority alerts.</p>
      ) : (
        <div className="space-y-2">
          {data.openConflictClients.map(c => (
            <Link
              key={c.client_id}
              href={`/advisor/clients/${c.client_id}`}
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-neutral-50 transition"
            >
              <span className="text-sm font-medium text-neutral-800 truncate">{c.full_name}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium shrink-0">
                {c.high_alert_count} high priority
              </span>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

interface Props {
  advisorId: string
  advisorName: string
}

export default function AnalyticsDashboardClient({ advisorId, advisorName }: Props) {
  const [data, setData] = useState<BookOfBusinessData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBookOfBusiness(advisorId).then(setData).finally(() => setLoading(false))
  }, [advisorId])

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <Link href="/advisor" className="text-sm text-indigo-600 hover:underline">
          ← Advisor Portal
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">Book-of-Business Analytics</h1>
        <p className="text-sm text-neutral-500 mt-1">
          {advisorName} · {data?.totalClients ?? '—'} active clients
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-neutral-400">Loading your book of business…</p>
          </div>
        </div>
      ) : !data || data.totalClients === 0 ? (
        <div className="text-center py-24">
          <p className="text-sm text-neutral-400">No active clients yet. Add clients to see analytics.</p>
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Active clients', value: data.totalClients.toString() },
              { label: 'Avg health score', value: data.averageHealthScore !== null ? `${data.averageHealthScore}/100` : '—' },
              { label: 'Total projected tax', value: fmt(data.totalProjectedTax) },
              { label: 'High priority alerts', value: data.openConflictClients.length.toString() },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-xl border border-neutral-200 px-4 py-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{item.label}</p>
                <p className="text-2xl font-bold text-neutral-900 mt-1">{item.value}</p>
              </div>
            ))}
          </div>

          {/* 6 panels grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HealthDistributionPanel data={data} />
            <TaxBandsPanel data={data} />
            <StaleDocumentsPanel data={data} />
            <SunsetOpportunityPanel data={data} />
            <UnplannedExposurePanel data={data} />
            <OpenConflictsPanel data={data} />
          </div>
        </>
      )}
    </div>
  )
}
