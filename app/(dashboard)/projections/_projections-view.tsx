'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

// Legacy projections table/chart row shape used by this standalone view.
// Kept local to avoid importing from deprecated legacy engine module.
type LegacyProjectionViewRow = {
  year: number
  person1_age: number
  gross_income: number
  taxable_income: number
  federal_tax: number
  state_tax: number
  total_expenses: number
  net_cash_flow: number
  total_net_worth: number
}

type ProjectionsViewProps = {
  projection: LegacyProjectionViewRow[]
  error: string | null
}

export function ProjectionsView({ projection, error }: ProjectionsViewProps) {
  if (error) {
    return (
      <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
        <p className="font-medium">Projection error</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    )
  }

  if (projection.length === 0) {
    return (
      <p className="mt-6 text-zinc-500 dark:text-zinc-400">
        No projection data. Add household, assets, and income to run projections.
      </p>
    )
  }

  const chartData = projection.map((y) => ({
    year: y.year,
    age: y.person1_age,
    gross_income: Math.round(y.gross_income),
    taxable_income: Math.round(y.taxable_income),
    federal_tax: Math.round(y.federal_tax),
    state_tax: Math.round(y.state_tax),
    total_expenses: Math.round(y.total_expenses),
    net_cash_flow: Math.round(y.net_cash_flow),
    total_net_worth: Math.round(y.total_net_worth),
  }))

  return (
    <div className="mt-6 space-y-8">
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 12 }}
              stroke="currentColor"
              className="text-zinc-500"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke="currentColor"
              className="text-zinc-500"
              tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1e3).toFixed(0)}k`)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
              }}
              formatter={(value) => [
                typeof value === 'number' && !Number.isNaN(value)
                  ? `$${value.toLocaleString()}`
                  : String(value ?? ''),
                '',
              ]}
              labelFormatter={(label) => `Year ${label}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="total_net_worth"
              name="Net worth"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="net_cash_flow"
              name="Net cash flow"
              stroke="hsl(var(--ring))"
              strokeWidth={2}
              dot={false}
              strokeDasharray="4 4"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
              >
                Year
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
              >
                Age
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
              >
                Gross income
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
              >
                Taxable
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
              >
                Federal income tax
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
              >
                State income tax
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
              >
                Expenses
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
              >
                Net cash flow
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
              >
                Net worth
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-900">
            {projection.map((y) => (
              <tr key={y.year} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {y.year}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-zinc-600 dark:text-zinc-400">
                  {y.person1_age}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-zinc-600 dark:text-zinc-400">
                  ${Math.round(y.gross_income).toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-zinc-600 dark:text-zinc-400">
                  ${Math.round(y.taxable_income).toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-zinc-600 dark:text-zinc-400">
                  ${Math.round(y.federal_tax).toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-zinc-600 dark:text-zinc-400">
                  ${Math.round(y.state_tax).toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-zinc-600 dark:text-zinc-400">
                  ${Math.round(y.total_expenses).toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  ${Math.round(y.net_cash_flow).toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  ${Math.round(y.total_net_worth).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
