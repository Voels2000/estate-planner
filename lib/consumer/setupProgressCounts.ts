import type { SupabaseClient } from '@supabase/supabase-js'

export type SetupProgressCounts = {
  assets: number
  income: number
  expenses: number
  liabilities: number
  insurance: number
  hasAnyData: boolean
}

export async function fetchSetupProgressCounts(
  supabase: SupabaseClient,
  userId: string,
): Promise<SetupProgressCounts> {
  const [{ count: assets }, { count: income }, { count: expenses }, { count: liabilities }, { count: insurance }] =
    await Promise.all([
      supabase.from('assets').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
      supabase.from('income').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
      supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
      supabase.from('liabilities').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
      supabase.from('insurance_policies').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ])

  const counts = {
    assets: assets ?? 0,
    income: income ?? 0,
    expenses: expenses ?? 0,
    liabilities: liabilities ?? 0,
    insurance: insurance ?? 0,
  }

  return {
    ...counts,
    hasAnyData: Object.values(counts).some((n) => n > 0),
  }
}
