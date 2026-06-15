import type { SupabaseClient } from '@supabase/supabase-js'

/** Staging / legacy consumer Voels (avoels@outlook.com). Absent on prod after go-live cleanup. */
export const VOELS_CONSUMER_HOUSEHOLD_ID = '5ea14f56-e880-4992-87bc-0d815a450cdc'
export const VOELS_CONSUMER_USER_ID = 'dbff0d6c-4b8c-46f5-b8fc-5925b8e6bd93'
export const VOELS_ADVISOR_USER_ID = '854051be-3aac-4d43-8062-df414a7055e1'

export type VoelsPostDeployContext = {
  householdId: string
  scenarioId: string
  consumerUserId: string
  advisorUserId: string
  source: 'env' | 'consumer-hardcoded' | 'consumer-email' | 'advisor-my-plan'
}

type HouseholdRow = {
  id: string
  owner_id: string
  state_primary: string | null
  base_case_scenario_id: string | null
  person1_name: string | null
}

async function findUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) return null
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null
}

async function householdForOwner(
  admin: SupabaseClient,
  ownerId: string,
): Promise<HouseholdRow | null> {
  const { data } = await admin
    .from('households')
    .select('id, owner_id, state_primary, base_case_scenario_id, person1_name')
    .eq('owner_id', ownerId)
    .maybeSingle()
  return data
}

async function householdById(
  admin: SupabaseClient,
  householdId: string,
): Promise<HouseholdRow | null> {
  const { data } = await admin
    .from('households')
    .select('id, owner_id, state_primary, base_case_scenario_id, person1_name')
    .eq('id', householdId)
    .maybeSingle()
  return data
}

function toContext(
  household: HouseholdRow,
  consumerUserId: string,
  advisorUserId: string,
  source: VoelsPostDeployContext['source'],
): VoelsPostDeployContext {
  return {
    householdId: household.id,
    scenarioId: household.base_case_scenario_id ?? '',
    consumerUserId,
    advisorUserId,
    source,
  }
}

/**
 * Resolve which Voels household to use for post-deploy gates.
 * Prod (post go-live cleanup): avoels@outlook.com is gone — falls back to advisor My Plan (avoels@comcast.net).
 * Staging: consumer Voels household still exists at legacy UUID.
 */
export async function resolveVoelsPostDeployContext(
  admin: SupabaseClient,
): Promise<VoelsPostDeployContext | null> {
  const advisorEmail = process.env.SMOKE_ADVISOR_EMAIL ?? 'avoels@comcast.net'
  const consumerEmail = process.env.SMOKE_VOELS_CONSUMER_EMAIL ?? 'avoels@outlook.com'

  const advisorUserId =
    (await findUserIdByEmail(admin, advisorEmail)) ?? VOELS_ADVISOR_USER_ID

  const envHouseholdId = process.env.VOELS_POST_DEPLOY_HOUSEHOLD_ID?.trim()
  if (envHouseholdId) {
    const household = await householdById(admin, envHouseholdId)
    if (household) {
      return toContext(household, household.owner_id, advisorUserId, 'env')
    }
  }

  const legacyConsumer = await householdById(admin, VOELS_CONSUMER_HOUSEHOLD_ID)
  if (legacyConsumer) {
    const consumerUserId =
      (await findUserIdByEmail(admin, consumerEmail)) ?? VOELS_CONSUMER_USER_ID
    return toContext(legacyConsumer, consumerUserId, advisorUserId, 'consumer-hardcoded')
  }

  const consumerUserId = await findUserIdByEmail(admin, consumerEmail)
  if (consumerUserId) {
    const household = await householdForOwner(admin, consumerUserId)
    if (household) {
      return toContext(household, consumerUserId, advisorUserId, 'consumer-email')
    }
  }

  const advisorOwnerId = await findUserIdByEmail(admin, advisorEmail)
  if (advisorOwnerId) {
    const household = await householdForOwner(admin, advisorOwnerId)
    if (household) {
      return toContext(household, advisorOwnerId, advisorUserId, 'advisor-my-plan')
    }
  }

  return null
}
