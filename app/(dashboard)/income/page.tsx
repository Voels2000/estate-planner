import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { IncomeClient } from './_income-client'
import type { IncomeRow } from '@/lib/validations/income'

export default async function IncomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: income } = await supabase
    .from('income')
    .select('id, owner_id, amount, source, start_year, end_year, inflation_adjust, created_at, updated_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const rows: IncomeRow[] = (income ?? []).map((row) => ({
    id: row.id,
    owner_id: row.owner_id,
    amount: Number(row.amount ?? 0),
    source: row.source ?? null,
    start_year: row.start_year != null ? Number(row.start_year) : null,
    end_year: row.end_year != null ? Number(row.end_year) : null,
    inflation_adjust: row.inflation_adjust ?? true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }))

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Income
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Track and plan your income streams.
      </p>
      <IncomeClient income={rows} ownerId={user.id} />
    </div>
  )
}
