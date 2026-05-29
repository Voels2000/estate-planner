import type { SupabaseClient } from '@supabase/supabase-js'

export type AssessmentHistoryRow = {
  id: string
  taken_at: string
  overall_score: number
  financial_pct: number
  retirement_pct: number
  estate_pct: number
}

export async function loadAssessmentHistory(
  supabase: SupabaseClient,
  userId: string,
  limit = 3,
): Promise<AssessmentHistoryRow[]> {
  const { data } = await supabase
    .from('assessment_results')
    .select('id, taken_at, overall_score, financial_pct, retirement_pct, estate_pct')
    .eq('user_id', userId)
    .order('taken_at', { ascending: false })
    .limit(limit)

  return (data ?? []) as AssessmentHistoryRow[]
}
