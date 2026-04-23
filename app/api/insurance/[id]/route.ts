import { createClient } from '@/lib/supabase/server'
import { triggerEstateHealthRecompute } from '@/lib/estate/triggerEstateHealthRecompute'
import { insurancePolicyRowForSave } from '@/lib/insurance-policy-save-payload'
import { NextRequest, NextResponse } from 'next/server'

// Fields that advisors can set directly without going through
// insurancePolicyRowForSave (which is designed for full policy saves).
const ADVISOR_DIRECT_FIELDS = new Set([
  'estate_inclusion_status',
])

async function resolvePolicyAuth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  policyId: string,
  userId: string,
): Promise<{ policyUserId: string | null; allowed: boolean }> {
  const { data: pol } = await supabase
    .from('insurance_policies')
    .select('id, user_id')
    .eq('id', policyId)
    .single()

  if (!pol) return { policyUserId: null, allowed: false }

  const isOwner = pol.user_id === userId
  if (isOwner) return { policyUserId: pol.user_id, allowed: true }

  // Check advisor link
  const { data: link } = await supabase
    .from('advisor_clients')
    .select('id')
    .eq('advisor_id', userId)
    .eq('client_id', pol.user_id)
    .eq('status', 'active')
    .single()

  return { policyUserId: pol.user_id, allowed: !!link }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { policyUserId, allowed } = await resolvePolicyAuth(supabase, id, user.id)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!policyUserId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json() as Record<string, unknown>

  // Check if this is an advisor direct-field update (e.g. estate_inclusion_status)
  // vs a full policy save that needs the transformer
  const bodyKeys = Object.keys(body)
  const isDirectFieldUpdate = bodyKeys.every(k => ADVISOR_DIRECT_FIELDS.has(k))

  let row: Record<string, unknown>
  if (isDirectFieldUpdate) {
    // Pass through directly — no transformation needed
    row = body
  } else {
    // Full policy save — use the transformer
    row = insurancePolicyRowForSave(body)
  }

  const { data, error } = await supabase
    .from('insurance_policies')
    .update(row)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Fire estate health recompute (best-effort, fire-and-forget)
  const { data: hh } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', policyUserId)
    .single()
  if (hh?.id) {
    triggerEstateHealthRecompute(hh.id, process.env.NEXT_PUBLIC_APP_URL ?? '')
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { policyUserId, allowed } = await resolvePolicyAuth(supabase, id, user.id)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!policyUserId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase
    .from('insurance_policies')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Fire estate health recompute (best-effort, fire-and-forget)
  const { data: hh } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', policyUserId)
    .single()
  if (hh?.id) {
    triggerEstateHealthRecompute(hh.id, process.env.NEXT_PUBLIC_APP_URL ?? '')
  }

  return NextResponse.json({ success: true })
}
