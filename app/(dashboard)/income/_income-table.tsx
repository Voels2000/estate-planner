'use client'

import { incomeSourceLabels, type IncomeRow } from '@/lib/validations/income'

type IncomeTableProps = {
  income: IncomeRow[]
  onEdit: (row: IncomeRow) => void
  onDelete: (id: string) => void
  deleteIncome: (id: string, ownerId: string) => Promise<void>
  ownerId: string
}

export function IncomeTable({
  income,
  onEdit,
  onDelete,
  deleteIncome,
  ownerId,
}: IncomeTableProps) {
  async function handleDelete(id: string) {
    if (!confirm('Remove this income entry?')) return
    try {
      await deleteIncome(id, ownerId)
      onDelete(id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  if (income.length === 0) {
    return (
      <p className="mt-4 text-zinc-500 dark:text-zinc-400">
        No income entries yet. Add one to get started.
      </p>
    )
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
        <thead className="bg-zinc-50 dark:bg-zinc-800/50">
          <tr>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              Source
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              Amount
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              Start
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              End
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              Inflation
            </th>
            <th scope="col" className="relative px-4 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-900">
          {income.map((row) => (
            <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
              <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                {row.source ? incomeSourceLabels[row.source as keyof typeof incomeSourceLabels] ?? row.source : '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
                ${Number(row.amount).toLocaleString()}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-zinc-600 dark:text-zinc-400">
                {row.start_year ?? '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-zinc-600 dark:text-zinc-400">
                {row.end_year ?? '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-zinc-600 dark:text-zinc-400">
                {row.inflation_adjust ? 'Yes' : 'No'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                <button
                  type="button"
                  onClick={() => onEdit(row)}
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Edit
                </button>
                <span className="mx-2 text-zinc-300 dark:text-zinc-600">|</span>
                <button
                  type="button"
                  onClick={() => handleDelete(row.id)}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
