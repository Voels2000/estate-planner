import { getUserAccess } from '@/lib/get-user-access'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import MyEstateTrustStrategyClient from './_client'

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

export default async function MyEstateTrustStrategyPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const access = await getUserAccess()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (access.tier < 3) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">My Estate & Trust Strategy</h1>
        <UpgradeBanner
          requiredTier={3}
          moduleName="Gifting, Strategies & Trusts"
          valueProposition="Track gifting, charitable giving, and estate transfer strategies in one place."
        />
      </div>
    )
  }

  const { data: householdRow } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!householdRow?.id) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <p className="text-sm text-neutral-500">No household found. Please complete your profile first.</p>
      </div>
    )
  }

  const { data: advisorRecommendations } = await supabase
    .from('strategy_configs')
    .select('strategy_type, label')
    .eq('household_id', householdRow.id)
    .eq('is_active', true)

  // Create one in-app notification per newly added advisor recommendation.
  const recommendationRows = advisorRecommendations ?? []
  const { data: existingRecommendationNotifs } = await supabase
    .from('notifications')
    .select('metadata')
    .eq('user_id', user.id)
    .eq('type', 'advisor_strategy_recommended')

  const alreadyNotified = new Set<string>(
    (existingRecommendationNotifs ?? [])
      .map((row) => {
        const strategyType = row.metadata?.strategy_type
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
        user_id: user.id,
        type: 'advisor_strategy_recommended',
        title: 'New advisor strategy recommendation',
        body: `${strategyLabel} was added to your recommended strategies list.`,
        delivery: 'in_app',
        read: false,
        metadata: { strategy_type: row.strategy_type, household_id: householdRow.id },
      }
    })

  if (newRecommendationNotifs.length > 0) {
    await supabase.from('notifications').insert(newRecommendationNotifs)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <MyEstateTrustStrategyClient
        householdId={householdRow.id}
        userRole={access.isAdvisor ? 'advisor' : 'consumer'}
        consumerTier={access.tier}
        initialTab={searchParams.tab ?? 'gifting'}
        advisorRecommendations={advisorRecommendations ?? []}
      />
    </div>
  )
}
