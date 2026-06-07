import type { createClient } from '@/lib/supabase/server'
import { getCachedComposition } from '@/lib/estate/getCachedComposition'
import type { EstateComposition } from '@/lib/estate/types'
import {
  getTrustWillChecklist,
  getTrustWillRecommendations,
} from '@/lib/trust-will-rules'
import { buildTrustWillProfile } from '@/lib/trusts/trustWillProfile'
import type {
  TrustRow,
  TrustWillChecklistItem,
  TrustWillRecommendation,
} from '@/lib/trusts/types'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

export type TrustWillGuidancePayload = {
  estateValue: number
  recommendations: TrustWillRecommendation[]
  checklist: TrustWillChecklistItem[]
  trusts: TrustRow[]
}

export async function loadTrustWillGuidance(
  supabase: ServerSupabase,
  userId: string,
  householdId: string,
  preloadedComposition?: EstateComposition | null,
): Promise<TrustWillGuidancePayload> {
  const compositionPromise = preloadedComposition
    ? Promise.resolve(preloadedComposition)
    : getCachedComposition(supabase, householdId, 'consumer', 0)

  const [
    composition,
    { data: trusts },
    { data: household },
    { data: domicile },
    { data: householdPeople },
    { data: businesses },
  ] = await Promise.all([
    compositionPromise,
    supabase
      .from('trusts')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('households')
      .select('id, has_spouse')
      .eq('id', householdId)
      .single(),
    supabase
      .from('domicile_analysis')
      .select('risk_level')
      .eq('household_id', householdId)
      .maybeSingle(),
    supabase
      .from('household_people')
      .select('date_of_birth, relationship')
      .eq('household_id', householdId),
    supabase.from('businesses').select('id').eq('owner_id', userId).limit(1),
  ])

  const profile = buildTrustWillProfile({
    grossEstate: composition.gross_estate ?? composition.inside_total ?? 0,
    hasSpouse: household?.has_spouse === true || composition.has_spouse,
    hasExistingTrust: (trusts?.length ?? 0) > 0,
    hasBusinessInterests:
      (composition.inside_business_taxable ?? 0) > 0 || (businesses?.length ?? 0) > 0,
    domicileRiskLevel: domicile?.risk_level ?? null,
    householdPeople: householdPeople ?? [],
  })

  return {
    estateValue: profile.estateValue,
    recommendations: getTrustWillRecommendations(profile),
    checklist: getTrustWillChecklist(profile),
    trusts: (trusts as TrustRow[]) ?? [],
  }
}
