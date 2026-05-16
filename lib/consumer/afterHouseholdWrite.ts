import { NextResponse } from 'next/server'
import type { createClient } from '@/lib/supabase/server'
import { triggerEstateHealthRecompute } from '@/lib/estate/triggerEstateHealthRecompute'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

export function getConsumerAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

export async function touchHousehold(supabase: ServerSupabase, householdId: string) {
  await supabase
    .from('households')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', householdId)
}

export function triggerHouseholdRecompute(householdId: string) {
  void triggerEstateHealthRecompute(householdId, getConsumerAppUrl())
}

/** Touch staleness timestamp and fire estate health recompute (non-blocking). */
export async function afterHouseholdWrite(supabase: ServerSupabase, householdId: string) {
  await touchHousehold(supabase, householdId)
  triggerHouseholdRecompute(householdId)
}

/** Resolve household by owner user id, then touch + recompute (businesses, insurance, etc.). */
export async function afterHouseholdWriteForOwner(
  supabase: ServerSupabase,
  ownerUserId: string,
) {
  const householdId = await resolveOwnedHouseholdId(supabase, ownerUserId)
  if (householdId) {
    await afterHouseholdWrite(supabase, householdId)
  }
}

/** Resolve household id for the authenticated owner; optional id must match. */
export async function resolveOwnedHouseholdId(
  supabase: ServerSupabase,
  userId: string,
  householdId?: string,
): Promise<string | null> {
  let query = supabase.from('households').select('id').eq('owner_id', userId)
  if (householdId) {
    query = query.eq('id', householdId)
  }
  const { data } = await query.single()
  return data?.id ?? null
}

export type OwnedHouseholdResult =
  | { ok: true; householdId: string }
  | { ok: false; response: NextResponse }

/** Household lookup for consumer write routes; returns 404 response when missing. */
export async function requireOwnedHouseholdId(
  supabase: ServerSupabase,
  userId: string,
): Promise<OwnedHouseholdResult> {
  const householdId = await resolveOwnedHouseholdId(supabase, userId)
  if (!householdId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Household not found' }, { status: 404 }),
    }
  }
  return { ok: true, householdId }
}
