// ─────────────────────────────────────────
// Menu: Financial Planning > Expenses
// Route: /expenses
// ─────────────────────────────────────────

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { displayPersonFirstName } from '@/lib/display-person-name'
import ExpensesClient from './_expenses-client'

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: expenses },
    { data: expenseTypes },
    { data: household },
  ] = await Promise.all([
    supabase
      .from('expenses')
      .select('id, owner_id, owner, category, name, amount, start_year, end_year, inflation_adjust, created_at, updated_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('expense_types')
      .select('value, label')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('households')
      .select('person1_name, person2_name, has_spouse')
      .eq('owner_id', user.id)
      .single(),
  ])

  return (
    <ExpensesClient
      initialExpenses={expenses ?? []}
      expenseTypes={expenseTypes ?? []}
      person1Name={displayPersonFirstName(household?.person1_name, 'Person 1')}
      person2Name={displayPersonFirstName(household?.person2_name, 'Person 2')}
    />
  )
}
