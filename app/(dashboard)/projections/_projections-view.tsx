'use client'

import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { ProjectionYear } from '@/lib/calculations/projection'

const TAB_OPTIONS = [
  { id: 'summary' as const, label: 'Summary & chart' },
  { id: 'table' as const, label: 'Year-by-year' },
]

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

type Props = {
  projection: ProjectionYear[]
  error: string | null
}

export function ProjectionsView({ projection, error }: Props) {
  if (error) {
    return (
      <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
        {error}
      </div>
    )
  }

  if (projection.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50/50 px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No projection data. Add assets and complete your profile to see projections.
        </p>
      </div>
    )
  }

  const first = projection[0]
  const last = projection[projection.length - 1]
  const peak = projection.reduce(
    (max, row) => (row.total_net_worth > max ? row.total_net_worth : max),
    0
  )
  const avgCashFlow =
    projection.reduce((sum, row) => sum + row.net_cash_flow, 0) / projection.length

  const summaryCards = [
    { label: 'Starting net worth', value: first.total_net_worth },
    { label: 'Ending net worth', value: last.total_net_worth },
    { label: 'Peak net worth', value: peak },
    { label: 'Avg. annual net cash flow', value: avgCashFlow },
  ]

  const chartData = projection.map((row) => ({
    year: row.year,
    netWorth: row.total_net_worth,
  }))

  const [activeTab, setActiveTab] = useState<'summary' | 'table'>('summary')
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="mt-6 space-y-6">
      {/* Tabs */}
      <div
        className="flex gap-0 rounded-lg border border-zinc-200 bg-zinc-100/80 p-1 dark:border-zinc-700 dark:bg-zinc-800/80"
        role="tablist"
      >
        {TAB_OPTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === id
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div className="space-y-8">
      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {label}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatCurrency(value)}
            </p>
          </div>
        ))}
      </div>

      {/* Net worth chart - fixed height so ResponsiveContainer has explicit dimensions */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Net worth over time
        </h2>
        <div style={{ height: 300 }}>
          {mounted && (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 12 }}
                  className="text-zinc-600 dark:text-zinc-400"
                />
                <YAxis
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12 }}
                  className="text-zinc-600 dark:text-zinc-400"
                />
                <Tooltip
                  formatter={(value: unknown) => [formatCurrency(Number(value ?? 0)), 'Net worth']}
                  labelFormatter={(year) => `Year ${year}`}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="netWorth"
                  stroke="rgb(59 130 246)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
        </div>
      )}

      {activeTab === 'table' && (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
            <thead className="bg-zinc-50 dark:bg-zinc-900/80">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                >
                  Year
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                >
                  Age
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                >
                  Gross income
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                >
                  Federal tax
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                >
                  State tax
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                >
                  Total expenses
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                >
                  Net cash flow
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                >
                  Total net worth
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-950">
              {projection.map((row) => (
                <tr key={row.year} className="text-zinc-900 dark:text-zinc-100">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">{row.year}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums">
                    {row.person1_age}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums">
                    {formatCurrency(row.gross_income)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums">
                    {formatCurrency(row.federal_tax)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums">
                    {formatCurrency(row.state_tax)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums">
                    {formatCurrency(row.total_expenses)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums">
                    <span
                      className={
                        row.net_cash_flow >= 0
                          ? 'text-zinc-900 dark:text-zinc-50'
                          : 'text-red-600 dark:text-red-400'
                      }
                    >
                      {formatCurrency(row.net_cash_flow)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium tabular-nums">
                    {formatCurrency(row.total_net_worth)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  )
}
