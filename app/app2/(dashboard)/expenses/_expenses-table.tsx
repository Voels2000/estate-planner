'use client'

import type { ExpenseRow } from '@/lib/validations/expenses'
import { expenseCategoryLabels } from '@/lib/validations/expenses'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

type Props = {
  expenses: ExpenseRow[]
}

export function ExpensesTable({ expenses }: Props) {
  if (expenses.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No expenses yet. Add your first expense to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
        <thead className="bg-zinc-50 dark:bg-zinc-900/80">
          <tr>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
            >
              Category
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
            >
              Amount
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
            >
              Start year
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
            >
              End year
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
            >
              Inflation adjust
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
          {expenses.map((row) => (
            <tr key={row.id} className="text-zinc-900 dark:text-zinc-100">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
                {row.category && row.category in expenseCategoryLabels
                  ? expenseCategoryLabels[row.category as keyof typeof expenseCategoryLabels]
                  : row.category ?? '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums">
                {formatCurrency(Number(row.amount))}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                {row.start_year ?? '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                {row.end_year ?? '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                {row.inflation_adjust ? 'Yes' : 'No'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
