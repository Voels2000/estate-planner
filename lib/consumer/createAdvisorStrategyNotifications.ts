import type { SupabaseClient } from '@supabase/supabase-js'

const ADVISOR_STRATEGY_LABELS: Record<string, string> = {
  gifting: 'Annual Gifting Program',
  revocable_trust: 'Revocable Living Trust',
  credit_shelter_trust: 'Credit Shelter Trust (CST)',
  grat: 'Grantor Retained Annuity Trust (GRAT)',
  crt: 'Charitable Remainder Trust (CRT)',
  clat: 'Charitable Lead Annuity Trust (CLAT)',
  daf: 'Donor Advised Fund (DAF)',
  roth: 'Roth Conversion',
  liquidity: 'Estate Liquidity Planning',
}

/** Create in-app notifications for newly active advisor strategy_configs rows. Idempotent. */
export async function createAdvisorStrategyNotifications(
  supabase: SupabaseClient,
  userId: string,
  householdId: string,
): Promise<number> {
  const { data: advisorRecommendations } = await supabase
    .from('strategy_configs')
    .select('strategy_type, label')
    .eq('household_id', householdId)
    .eq('is_active', true)

  const recommendationRows = advisorRecommendations ?? []
  if (recommendationRows.length === 0) return 0

  const { data: existingRecommendationNotifs } = await supabase
    .from('notifications')
    .select('metadata')
    .eq('user_id', userId)
    .eq('type', 'advisor_strategy_recommended')

  const alreadyNotified = new Set<string>(
    (existingRecommendationNotifs ?? [])
      .map((row) => {
        const strategyType = (row.metadata as { strategy_type?: string } | null)?.strategy_type
        return typeof strategyType === 'string' ? strategyType : null
      })
      .filter((value): value is string => value !== null),
  )

  const newRecommendationNotifs = recommendationRows
    .filter((row) => !alreadyNotified.has(row.strategy_type))
    .map((row) => {
      const strategyLabel =
        row.label ?? ADVISOR_STRATEGY_LABELS[row.strategy_type] ?? row.strategy_type
      return {
        user_id: userId,
        type: 'advisor_strategy_recommended',
        title: 'New advisor strategy recommendation',
        body: `${strategyLabel} was added to your recommended strategies list.`,
        delivery: 'in_app',
        read: false,
        metadata: { strategy_type: row.strategy_type, household_id: householdId },
      }
    })

  if (newRecommendationNotifs.length === 0) return 0

  const { error } = await supabase.from('notifications').insert(newRecommendationNotifs)
  if (error) {
    console.error('[createAdvisorStrategyNotifications]', error.message)
    return 0
  }
  return newRecommendationNotifs.length
}
