'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  incomeFormSchema,
  incomeSourceLabels,
  type IncomeFormValues,
  type IncomeRow,
} from '@/lib/validations/income'

type AddIncomeModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  ownerId: string
  editRow: IncomeRow | null
  addIncome: (ownerId: string, values: IncomeFormValues) => Promise<void>
  updateIncome: (
    id: string,
    ownerId: string,
    values: IncomeFormValues
  ) => Promise<void>
}

const defaultValues: IncomeFormValues = {
  source: 'salary',
  amount: 0,
  start_year: new Date().getFullYear(),
  end_year: '',
  inflation_adjust: true,
}

export function AddIncomeModal({
  isOpen,
  onClose,
  onSuccess,
  ownerId,
  editRow,
  addIncome,
  updateIncome,
}: AddIncomeModalProps) {
  const form = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeFormSchema),
    defaultValues,
    values: editRow
      ? {
          source: (editRow.source as IncomeFormValues['source']) ?? 'salary',
          amount: editRow.amount,
          start_year: editRow.start_year ?? new Date().getFullYear(),
          end_year: editRow.end_year ?? '',
          inflation_adjust: editRow.inflation_adjust,
        }
      : undefined,
  })

  async function onSubmit(values: IncomeFormValues) {
    try {
      if (editRow) {
        await updateIncome(editRow.id, ownerId, values)
      } else {
        await addIncome(ownerId, values)
      }
      form.reset(defaultValues)
      onSuccess()
      onClose()
    } catch (err) {
      form.setError('root', {
        message: err instanceof Error ? err.message : 'Something went wrong',
      })
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-income-title"
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-income-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {editRow ? 'Edit income' : 'Add income'}
        </h2>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-4 space-y-4"
        >
          <div>
            <label
              htmlFor="source"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Source
            </label>
            <select
              id="source"
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              {...form.register('source')}
            >
              {Object.entries(incomeSourceLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {form.formState.errors.source && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {form.formState.errors.source.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Amount ($/year)
            </label>
            <input
              id="amount"
              type="number"
              step="any"
              min="0"
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              {...form.register('amount', { valueAsNumber: true })}
            />
            {form.formState.errors.amount && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {form.formState.errors.amount.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="start_year"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Start year
              </label>
              <input
                id="start_year"
                type="number"
                min="1900"
                max="2100"
                className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                {...form.register('start_year', { valueAsNumber: true })}
              />
              {form.formState.errors.start_year && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {form.formState.errors.start_year.message}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="end_year"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                End year (optional)
              </label>
              <input
                id="end_year"
                type="number"
                min="1900"
                max="2100"
                placeholder="Leave blank for ongoing"
                className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                {...form.register('end_year', {
                  setValueAs: (v) => (v === '' || v == null ? '' : Number(v)),
                })}
              />
              {form.formState.errors.end_year && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {form.formState.errors.end_year.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="inflation_adjust"
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800"
              {...form.register('inflation_adjust')}
            />
            <label
              htmlFor="inflation_adjust"
              className="text-sm text-zinc-700 dark:text-zinc-300"
            >
              Adjust for inflation in projections
            </label>
          </div>
          {form.formState.errors.inflation_adjust && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {form.formState.errors.inflation_adjust.message}
            </p>
          )}

          {form.formState.errors.root && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {form.formState.errors.root.message}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {form.formState.isSubmitting ? 'Saving…' : editRow ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
