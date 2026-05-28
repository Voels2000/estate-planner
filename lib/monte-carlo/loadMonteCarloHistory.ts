import { createAdminClient } from '@/lib/supabase/admin'

export async function loadMonteCarloHistory(userId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('monte_carlo_runs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}
