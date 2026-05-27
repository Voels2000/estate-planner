import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'

async function verifyAdvisorHouseholdAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  advisorId: string,
  householdId: string,
) {
  const { data: household } = await supabase
    .from('households')
    .select('id, owner_id')
    .eq('id', householdId)
    .single()
  if (!household) {
    return { ok: false as const, status: 404, error: 'Household not found' }
  }

  const { data: link } = await supabase
    .from('advisor_clients')
    .select('id')
    .eq('advisor_id', advisorId)
    .eq('client_id', household.owner_id)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
    .not('accepted_at', 'is', null)
    .maybeSingle()

  if (!link) {
    return {
      ok: false as const,
      status: 403,
      error: 'Forbidden — not an active advisor for this client',
    }
  }

  return { ok: true as const, householdId: household.id }
}

type GstEntryPayload = {
  transfer_year?: number
  transfer_amount?: number
  gst_exemption_allocated?: number
  is_skip_person?: boolean
  beneficiary_label?: string | null
  notes?: string | null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { householdId?: string; gstEntry?: GstEntryPayload }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { householdId, gstEntry } = body
  if (!householdId || !gstEntry) {
    return NextResponse.json({ error: 'householdId and gstEntry required' }, { status: 400 })
  }

  const access = await verifyAdvisorHouseholdAccess(supabase, user.id, householdId)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('gst_ledger')
    .insert({
      household_id: access.householdId,
      transfer_year: gstEntry.transfer_year,
      transfer_amount: gstEntry.transfer_amount,
      gst_exemption_allocated: gstEntry.gst_exemption_allocated,
      is_skip_person: gstEntry.is_skip_person ?? false,
      beneficiary_label: gstEntry.beneficiary_label ?? null,
      notes: gstEntry.notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: data })
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const entryId = searchParams.get('id')
  const householdId = searchParams.get('householdId')

  if (!entryId || !householdId) {
    return NextResponse.json({ error: 'id and householdId required' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await verifyAdvisorHouseholdAccess(supabase, user.id, householdId)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('gst_ledger')
    .delete()
    .eq('id', entryId)
    .eq('household_id', access.householdId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
