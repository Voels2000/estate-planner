import { createAdminClient } from '@/lib/supabase/admin'

/** Distinct asset names — both users get a row so absence proves ownership filter, not empty B. */
export const EXPORT_ISOLATION_MARKER_A = 'e2e-export-isolation-marker-consumer-a'
export const EXPORT_ISOLATION_MARKER_B = 'e2e-export-isolation-marker-advisor-client-b'

const MARKER_VALUE = 999_001

/**
 * Seed one asset per user with unique names. Requires service role (security / seeded E2E).
 */
export async function seedExportIsolationMarkers(
  consumerOwnerUserId: string,
  advisorClientOwnerUserId: string,
): Promise<void> {
  const admin = createAdminClient()

  for (const [ownerId, name] of [
    [consumerOwnerUserId, EXPORT_ISOLATION_MARKER_A],
    [advisorClientOwnerUserId, EXPORT_ISOLATION_MARKER_B],
  ] as const) {
    await admin.from('assets').delete().eq('owner_id', ownerId).eq('name', name)
    const { error } = await admin.from('assets').insert({
      owner_id: ownerId,
      owner: 'person1',
      type: 'taxable_brokerage',
      name,
      value: MARKER_VALUE,
    })
    if (error) {
      throw new Error(`export isolation seed ${name}: ${error.message}`)
    }
  }
}
