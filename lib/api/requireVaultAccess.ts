import type { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { assertHouseholdAccess } from '@/lib/api/assertHouseholdAccess'
import { verifyAttorneyHouseholdAccess } from '@/lib/attorney/verifyAttorneyHouseholdAccess'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

export type VaultAccessResult =
  | { ok: true; role: 'consumer' | 'advisor' | 'attorney' }
  | { ok: false; response: NextResponse }

/** Consumer owner, connected advisor, or linked attorney for document vault routes. */
export async function requireVaultHouseholdAccess(
  supabase: ServerSupabase,
  userId: string,
  householdId: string,
  callerRole: string | null | undefined,
): Promise<VaultAccessResult> {
  if (callerRole === 'attorney') {
    const access = await verifyAttorneyHouseholdAccess(supabase, userId, householdId)
    if (!access.ok) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: access.status === 404 ? 'Attorney listing not found' : 'Forbidden' },
          { status: access.status },
        ),
      }
    }
    return { ok: true, role: 'attorney' }
  }

  const access = await assertHouseholdAccess(supabase, userId, householdId)
  if (!access.ok) {
    const status = access.reason === 'not_found' ? 404 : 403
    return {
      ok: false,
      response: NextResponse.json(
        { error: access.reason === 'not_found' ? 'Household not found' : 'Forbidden' },
        { status },
      ),
    }
  }

  return { ok: true, role: access.isOwner ? 'consumer' : 'advisor' }
}
