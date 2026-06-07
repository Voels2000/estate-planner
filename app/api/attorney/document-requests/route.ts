import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { getAttorneyListingIdForUser } from '@/lib/attorney/attorneyClientCap'
import { ATTORNEY_DOC_REQUEST_TYPES } from '@/lib/attorney/matterWorkflow'
import {
  resolveConsumerHouseholdId,
  verifyAttorneyHouseholdAccess,
} from '@/lib/attorney/verifyAttorneyHouseholdAccess'

const VALID_DOC_TYPES = new Set(ATTORNEY_DOC_REQUEST_TYPES.map((d) => d.value))

export async function GET(req: NextRequest) {
  const ctx = await getAccessContext()
  if (!ctx.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const householdIdParam = req.nextUrl.searchParams.get('household_id')
  const supabase = await createClient()

  if (ctx.isAttorney) {
    const listingId = await getAttorneyListingIdForUser(supabase, ctx.user.id)
    if (!listingId) return NextResponse.json({ requests: [] })

    let query = supabase
      .from('attorney_document_requests')
      .select(
        'id, household_id, document_type, message, status, requested_at, fulfilled_at, cancelled_at',
      )
      .eq('attorney_listing_id', listingId)
      .order('requested_at', { ascending: false })

    if (householdIdParam) {
      query = query.eq('household_id', householdIdParam)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ requests: data ?? [] })
  }

  const householdId = await resolveConsumerHouseholdId(supabase, ctx.user.id)
  if (!householdId) return NextResponse.json({ requests: [] })

  const { data, error } = await supabase
    .from('attorney_document_requests')
    .select(
      'id, document_type, message, status, requested_at, fulfilled_at, attorney_listing_id, attorney_listings(firm_name, contact_name)',
    )
    .eq('household_id', householdId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requests: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { user, isAttorney } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAttorney) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const { household_id, document_type, message } = body ?? {}
  if (!household_id || !document_type) {
    return NextResponse.json({ error: 'household_id and document_type required' }, { status: 400 })
  }
  if (!VALID_DOC_TYPES.has(document_type)) {
    return NextResponse.json({ error: 'Invalid document_type' }, { status: 400 })
  }

  const supabase = await createClient()
  const admin = createAdminClient()
  const access = await verifyAttorneyHouseholdAccess(supabase, user.id, household_id)
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: access.status })

  const { data: row, error } = await supabase
    .from('attorney_document_requests')
    .insert({
      attorney_listing_id: access.listingId,
      household_id,
      attorney_client_id: access.connectionId,
      document_type,
      message: typeof message === 'string' ? message.trim() || null : null,
      requested_by: user.id,
    })
    .select('id, document_type, message, status, requested_at')
    .single()

  if (error) {
    console.error('[attorney/document-requests POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: household } = await admin
    .from('households')
    .select('owner_id')
    .eq('id', household_id)
    .single()

  if (household?.owner_id) {
    const docLabel =
      ATTORNEY_DOC_REQUEST_TYPES.find((d) => d.value === document_type)?.label ?? document_type
    void admin.rpc('create_notification', {
      p_user_id: household.owner_id,
      p_type: 'attorney_document_request',
      p_title: 'Document requested by your attorney',
      p_body: `Your attorney requested: ${docLabel}. Upload in My Attorney or your document vault.`,
      p_delivery: 'in_app',
      p_metadata: { request_id: row.id, document_type },
      p_cooldown: '1 hour',
    })
  }

  return NextResponse.json(row, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const ctx = await getAccessContext()
  if (!ctx.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { id, action } = body ?? {}
  if (!id || !action) {
    return NextResponse.json({ error: 'id and action required' }, { status: 400 })
  }

  const supabase = await createClient()

  if (ctx.isAttorney) {
    const listingId = await getAttorneyListingIdForUser(supabase, ctx.user.id)
    if (!listingId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (action === 'fulfill') {
      const { data, error } = await supabase
        .from('attorney_document_requests')
        .update({
          status: 'fulfilled',
          fulfilled_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('attorney_listing_id', listingId)
        .eq('status', 'pending')
        .select('id, status')
        .single()
      if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(data)
    }

    if (action === 'cancel') {
      const { data, error } = await supabase
        .from('attorney_document_requests')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('attorney_listing_id', listingId)
        .eq('status', 'pending')
        .select('id, status')
        .single()
      if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const householdId = await resolveConsumerHouseholdId(supabase, ctx.user!.id)
  if (!householdId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (action === 'cancel') {
    const { data, error } = await supabase
      .from('attorney_document_requests')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('household_id', householdId)
      .eq('status', 'pending')
      .select('id, status')
      .single()
    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
