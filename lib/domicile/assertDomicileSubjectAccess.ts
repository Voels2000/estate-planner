import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'

/** Consumer self-access or connected advisor access to a domicile subject user. */
export async function assertDomicileSubjectAccess(
  supabase: SupabaseClient,
  sessionUserId: string,
  targetUserId: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (targetUserId === sessionUserId) {
    return { ok: true }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', sessionUserId)
    .single()

  if (profile?.role !== 'advisor') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  const { data: link } = await supabase
    .from('advisor_clients')
    .select('id')
    .eq('advisor_id', sessionUserId)
    .eq('client_id', targetUserId)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
    .maybeSingle()

  if (!link) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true }
}
