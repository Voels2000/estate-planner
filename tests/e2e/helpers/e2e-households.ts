import type { APIRequestContext } from '@playwright/test'
import { createAdminClient } from '@/lib/supabase/admin'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import { findUserIdByEmail, initSupabaseEnv } from '../../../scripts/seed-e2e-lib'

export async function fetchHouseholdIdByOwnerEmail(email: string): Promise<string | null> {
  initSupabaseEnv()
  const ownerId = await findUserIdByEmail(email)
  if (!ownerId) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('households')
    .select('id')
    .eq('owner_id', ownerId)
    .maybeSingle()
  return data?.id ?? null
}

export async function fetchAdvisorClientHouseholdId(): Promise<string | null> {
  return fetchHouseholdIdByOwnerEmail(E2E_IDENTITIES.advisorClient.email)
}

/** Canonical e2e-consumer household — prefer over PLAYWRIGHT_HOUSEHOLD_ID (CI secret can drift). */
export async function resolveConsumerHouseholdId(): Promise<string | null> {
  return fetchHouseholdIdByOwnerEmail(E2E_IDENTITIES.consumer.email)
}

export async function fetchAttorneyListingId(): Promise<string | null> {
  initSupabaseEnv()
  const profileId = await findUserIdByEmail(E2E_IDENTITIES.attorneyPortal.email)
  if (!profileId) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('attorney_listings')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle()
  return data?.id ?? null
}

/** Ensure e2e attorney listing is linked to household for API smoke tests. */
export async function ensureAttorneyClientLink(householdId: string): Promise<boolean> {
  initSupabaseEnv()
  const listingId = await fetchAttorneyListingId()
  if (!listingId) return false

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('attorney_clients')
    .select('id, status')
    .eq('attorney_id', listingId)
    .eq('client_id', householdId)
    .maybeSingle()

  if (existing?.id) {
    if (existing.status !== 'active' && existing.status !== 'accepted') {
      await admin
        .from('attorney_clients')
        .update({ status: 'active', granted_at: new Date().toISOString() })
        .eq('id', existing.id)
    }
    return true
  }

  const { error } = await admin.from('attorney_clients').insert({
    attorney_id: listingId,
    client_id: householdId,
    status: 'active',
    granted_at: new Date().toISOString(),
  })

  if (!error) return true

  const isLegacyFk =
    error.message.includes('attorney_clients_attorney_id_fkey') ||
    error.message.includes('attorney_clients_client_id_fkey')

  if (isLegacyFk) {
    console.warn(
      '[e2e] attorney_clients FK mismatch — apply migration 20260630100000_attorney_clients_fk_listing_household.sql',
    )
  } else {
    console.warn('[e2e] ensureAttorneyClientLink insert failed:', error.message)
  }

  return false
}

type PlaywrightRequestFixture = {
  request: {
    newContext(options: {
      storageState: string
      baseURL: string
    }): Promise<APIRequestContext>
  }
}

/** Link attorney via consumer grant-access API (requires .auth/consumer.json). */
export async function grantAttorneyAccessViaConsumerApi(
  playwright: PlaywrightRequestFixture,
  baseURL: string,
): Promise<boolean> {
  const listingId = await fetchAttorneyListingId()
  if (!listingId) return false

  const ctx = await playwright.request.newContext({
    storageState: '.auth/consumer.json',
    baseURL,
  })
  try {
    const res = await ctx.post('/api/attorney/grant-access', {
      data: { attorney_id: listingId },
      timeout: 30_000,
    })
    if (res.status() === 409) return true
    if (!res.ok()) {
      console.warn('[e2e] grant-access failed:', res.status(), await res.text())
      return false
    }
    return true
  } finally {
    await ctx.dispose()
  }
}
