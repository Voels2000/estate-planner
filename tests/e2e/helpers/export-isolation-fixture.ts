import { expect } from '@playwright/test'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  EXPORT_INPUT_TABLES,
  type ExportInputTable,
} from '@/lib/access/inputComputedBoundary'

export const EXPORT_ISOLATION_MARKER_A = 'e2e-export-isolation-marker-consumer-a'
export const EXPORT_ISOLATION_MARKER_B = 'e2e-export-isolation-marker-advisor-client-b'

const MARKER_VALUE = 999_001

async function householdIdForOwner(ownerId: string): Promise<string> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('households')
    .select('id')
    .eq('owner_id', ownerId)
    .maybeSingle()
  if (error) throw error
  if (!data?.id) throw new Error(`export isolation: no household for owner ${ownerId}`)
  return data.id
}

async function deleteMarkerRow(
  table: ExportInputTable,
  ownerId: string,
  marker: string,
): Promise<void> {
  const admin = createAdminClient()
  if (table === 'households') {
    await admin.from('households').update({ name: 'E2E household' }).eq('owner_id', ownerId).eq('name', marker)
    return
  }
  if (table === 'insurance_policies') {
    await admin.from('insurance_policies').delete().eq('user_id', ownerId).eq('policy_name', marker)
    return
  }
  if (table === 'expenses') {
    await admin.from('expenses').delete().eq('owner_id', ownerId).eq('category', marker)
    return
  }
  const nameColumn = 'name' as const
  await admin.from(table).delete().eq('owner_id', ownerId).eq(nameColumn, marker)
}

async function insertMarkerRow(
  table: ExportInputTable,
  ownerId: string,
  marker: string,
  householdId: string,
): Promise<void> {
  const admin = createAdminClient()

  if (table === 'households') {
    const { error } = await admin.from('households').update({ name: marker }).eq('owner_id', ownerId)
    if (error) throw new Error(`export isolation seed households: ${error.message}`)
    return
  }

  let error: { message: string } | null = null

  switch (table) {
    case 'assets':
      ({ error } = await admin.from('assets').insert({
        owner_id: ownerId,
        owner: 'person1',
        type: 'taxable_brokerage',
        name: marker,
        value: MARKER_VALUE,
      }))
      break
    case 'liabilities':
      ({ error } = await admin.from('liabilities').insert({
        owner_id: ownerId,
        owner: 'person1',
        type: 'mortgage',
        name: marker,
        balance: MARKER_VALUE,
      }))
      break
    case 'income':
      ({ error } = await admin.from('income').insert({
        owner_id: ownerId,
        source: 'other',
        name: marker,
        amount: MARKER_VALUE,
        start_year: new Date().getFullYear(),
        inflation_adjust: false,
      }))
      break
    case 'expenses':
      ({ error } = await admin.from('expenses').insert({
        owner_id: ownerId,
        category: marker,
        amount: MARKER_VALUE,
        start_year: new Date().getFullYear(),
        inflation_adjust: false,
      }))
      break
    case 'insurance_policies':
      ({ error } = await admin.from('insurance_policies').insert({
        user_id: ownerId,
        policy_name: marker,
        insurance_type: 'life',
        death_benefit: MARKER_VALUE,
      }))
      break
    case 'real_estate':
      ({ error } = await admin.from('real_estate').insert({
        owner_id: ownerId,
        owner: 'person1',
        name: marker,
        property_type: 'other',
        current_value: MARKER_VALUE,
      }))
      break
    case 'businesses':
      ({ error } = await admin.from('businesses').insert({
        owner_id: ownerId,
        household_id: householdId,
        name: marker,
        entity_type: 'llc',
        estimated_value: MARKER_VALUE,
        ownership_pct: 100,
      }))
      break
    default:
      throw new Error(`export isolation: unhandled table ${table satisfies never}`)
  }

  if (error) {
    throw new Error(`export isolation seed ${table}: ${error.message}`)
  }
}

/**
 * Seed one marker row per EXPORT_INPUT_TABLES table for each user.
 * Row-level isolation: a leak in any exported table surfaces marker-b in A's payload.
 */
export async function seedExportIsolationMarkers(
  consumerOwnerUserId: string,
  advisorClientOwnerUserId: string,
): Promise<void> {
  for (const [ownerId, marker] of [
    [consumerOwnerUserId, EXPORT_ISOLATION_MARKER_A],
    [advisorClientOwnerUserId, EXPORT_ISOLATION_MARKER_B],
  ] as const) {
    const householdId = await householdIdForOwner(ownerId)
    for (const table of EXPORT_INPUT_TABLES) {
      await deleteMarkerRow(table, ownerId, marker)
      await insertMarkerRow(table, ownerId, marker, householdId)
    }
  }
}

/** Assert marker appears somewhere in the full export JSON (all tables + metadata). */
export function expectExportPayloadContainsMarker(body: string, marker: string): void {
  expect(body, `export should include marker ${marker}`).toContain(marker)
}

/** Sweep every exported table array — marker must be absent in each and in the full body. */
export function expectExportPayloadExcludesMarker(
  body: string,
  payload: { tables: Record<string, unknown[]> },
  marker: string,
): void {
  expect(body, `foreign marker ${marker} must not appear in export body`).not.toContain(marker)
  for (const table of EXPORT_INPUT_TABLES) {
    expect(
      JSON.stringify(payload.tables[table] ?? []),
      `foreign marker ${marker} must not appear in export table ${table}`,
    ).not.toContain(marker)
  }
}
