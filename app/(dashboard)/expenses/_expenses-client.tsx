'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExpensesTable } from './_expenses-table'
import { AddExpenseModal } from './_add-expense-modal'
import type { ExpenseRow } from '@/lib/validations/expenses'

type Props = {
  expenses: ExpenseRow[]
  ownerId: string
}

export function ExpensesClient({ expenses, ownerId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)

  function handleSuccess() {
    router.refresh()
  }

  return (
    <>
      <div className="mt-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-50 shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Add expense
          </button>
        </div>
        <div className="mt-4">
          <ExpensesTable expenses={expenses} />
        </div>
      </div>
      <AddExpenseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
        ownerId={ownerId}
      />
    </>
  )
}
