'use client'

import { useRef, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import {
  expenseFormSchema,
  type ExpenseFormValues,
  EXPENSE_CATEGORIES,
  expenseCategoryLabels,
} from '@/lib/validations/expenses'

const currentYear = new Date().getFullYear()

const defaultValues: ExpenseFormValues = {
  category: 'housing',
  amount: 0,
  start_year: currentYear,
  end_year: '',
  inflation_adjust: true,
}

const inputClass =
  'block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100 dark:focus:ring-zinc-100'
const labelClass = 'block text-sm font-medium text-zinc-800 dark:text-zinc-200'
const errorClass = 'mt-1 text-sm text-red-600 dark:text-red-400'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  ownerId: string
}

export function AddExpenseModal({ open, onClose, onSuccess, ownerId }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema) as Resolver<ExpenseFormValues>,
    defaultValues,
  })

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open) {
      setSubmitError(null)
      reset(defaultValues)
      el.showModal()
    } else {
      el.close()
    }
  }, [open, reset])

  function onBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose()
  }

  async function onSubmit(values: ExpenseFormValues) {
    setSubmitError(null)
    const supabase = createClient()
    const endYear =
      values.end_year === '' || values.end_year == null
        ? null
        : Number(values.end_year)

    const { error } = await supabase.from('expenses').insert({
      owner_id: ownerId,
      category: values.category,
      amount: Number(values.amount),
      start_year: values.start_year,
      end_year: endYear,
      inflation_adjust: values.inflation_adjust,
    })

    if (error) {
      setSubmitError(error.message)
      return
    }
    onSuccess()
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClick={onBackdropClick}
      className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl backdrop:bg-black/20 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-700">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Add expense
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="expense-category" className={labelClass}>
            Category
          </label>
          <select
            id="expense-category"
            className={inputClass}
            {...register('category')}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {expenseCategoryLabels[c]}
              </option>
            ))}
          </select>
          {errors.category && <p className={errorClass}>{errors.category.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="expense-amount" className={labelClass}>
            Amount ($/year)
          </label>
          <input
            id="expense-amount"
            type="number"
            min={0}
            step={0.01}
            placeholder="0"
            className={inputClass}
            {...register('amount', { valueAsNumber: true })}
          />
          {errors.amount && <p className={errorClass}>{errors.amount.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="expense-start-year" className={labelClass}>
            Start year
          </label>
          <input
            id="expense-start-year"
            type="number"
            min={1900}
            max={2100}
            placeholder={String(currentYear)}
            className={inputClass}
            {...register('start_year', { valueAsNumber: true })}
          />
          {errors.start_year && (
            <p className={errorClass}>{errors.start_year.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="expense-end-year" className={labelClass}>
            End year (optional)
          </label>
          <input
            id="expense-end-year"
            type="number"
            min={1900}
            max={2100}
            placeholder="Leave blank for ongoing"
            className={inputClass}
            {...register('end_year')}
          />
          {errors.end_year && (
            <p className={errorClass}>{errors.end_year.message}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            id="expense-inflation-adjust"
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-zinc-100"
            {...register('inflation_adjust')}
          />
          <label
            htmlFor="expense-inflation-adjust"
            className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
          >
            Inflation adjust
          </label>
        </div>

        {submitError && (
          <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-50 shadow-sm transition hover:bg-zinc-800 disabled:opacity-70 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {isSubmitting ? 'Adding…' : 'Add expense'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
