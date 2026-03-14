'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IncomeTable } from './_income-table'
import { AddIncomeModal } from './_add-income-modal'
import type { IncomeRow } from '@/lib/validations/income'

type Props = {
  income: IncomeRow[]
  ownerId: string
}

export function IncomeClient({ income, ownerId }: Props) {
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
            {income.length} income stream{income.length !== 1 ? 's' : ''}
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-50 shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Add income
          </button>
        </div>
        <div className="mt-4">
          <IncomeTable income={income} />
        </div>
      </div>
      <AddIncomeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
        ownerId={ownerId}
      />
    </>
  )
}
