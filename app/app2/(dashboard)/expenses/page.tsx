import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ExpensesClient } from './_expenses-client'
import type { ExpenseRow } from '@/lib/validations/expenses'

export default async function ExpensesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, owner_id, amount, category, start_year, end_year, inflation_adjust, created_at, updated_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const rows: ExpenseRow[] = (expenses ?? []).map((row) => ({
    id: row.id,
    owner_id: row.owner_id,
    amount: Number(row.amount ?? 0),
    category: row.category ?? null,
    start_year: row.start_year != null ? Number(row.start_year) : null,
    end_year: row.end_year != null ? Number(row.end_year) : null,
    inflation_adjust: row.inflation_adjust ?? true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }))

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Expenses
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Track and plan your expenses.
      </p>
      <ExpensesClient expenses={rows} ownerId={user.id} />
    </div>
  )
}
