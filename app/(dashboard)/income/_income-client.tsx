'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { IncomeRow } from '@/lib/validations/income'
import { AddIncomeModal } from './_add-income-modal'
import { IncomeTable } from './_income-table'
import { addIncome, updateIncome, deleteIncome } from './actions'

type IncomeClientProps = {
  income: IncomeRow[]
  ownerId: string
}

export function IncomeClient({ income, ownerId }: IncomeClientProps) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<IncomeRow | null>(null)

  function handleSuccess() {
    router.refresh()
  }

  function openAdd() {
    setEditRow(null)
    setModalOpen(true)
  }

  function openEdit(row: IncomeRow) {
    setEditRow(row)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditRow(null)
  }

  return (
    <>
      <div className="mt-4">
        <button
          type="button"
          onClick={openAdd}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Add income
        </button>
      </div>

      <IncomeTable
        income={income}
        ownerId={ownerId}
        onEdit={openEdit}
        onDelete={() => router.refresh()}
        deleteIncome={deleteIncome}
      />

      <AddIncomeModal
        isOpen={modalOpen}
        onClose={closeModal}
        onSuccess={handleSuccess}
        ownerId={ownerId}
        editRow={editRow}
        addIncome={addIncome}
        updateIncome={updateIncome}
      />
    </>
  )
}
