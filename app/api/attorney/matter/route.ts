import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext } from '@/lib/access/getAccessContext'
import {
  getAttorneyListingIdForUser,
} from '@/lib/attorney/attorneyClientCap'
import {
  parseClientStatus,
  parseMatterStage,
} from '@/lib/attorney/matterWorkflow'
import { verifyAttorneyHouseholdAccess } from '@/lib/attorney/verifyAttorneyHouseholdAccess'

export async function PATCH(request: NextRequest) {
  const { user, isAttorney } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAttorney) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { household_id, matter_stage, client_status } = body ?? {}
  if (!household_id) {
    return NextResponse.json({ error: 'household_id required' }, { status: 400 })
  }

  const supabase = await createClient()
  const access = await verifyAttorneyHouseholdAccess(supabase, user.id, household_id)
  if (!access.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: access.status })
  }

  const update: Record<string, string> = {}
  if (matter_stage != null) {
    const stage = parseMatterStage(matter_stage)
    if (!stage) return NextResponse.json({ error: 'Invalid matter_stage' }, { status: 400 })
    update.matter_stage = stage
  }
  if (client_status != null) {
    const status = parseClientStatus(client_status)
    if (!status) return NextResponse.json({ error: 'Invalid client_status' }, { status: 400 })
    update.client_status = status
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('attorney_clients')
    .update(update)
    .eq('id', access.connectionId)
    .select('id, matter_stage, client_status')
    .single()

  if (error) {
    console.error('[attorney/matter PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function GET(request: NextRequest) {
  const { user, isAttorney } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAttorney) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const householdId = request.nextUrl.searchParams.get('household_id')
  if (!householdId) {
    return NextResponse.json({ error: 'household_id required' }, { status: 400 })
  }

  const supabase = await createClient()
  const listingId = await getAttorneyListingIdForUser(supabase, user.id)
  if (!listingId) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('attorney_clients')
    .select('id, matter_stage, client_status, granted_at')
    .eq('attorney_id', listingId)
    .eq('client_id', householdId)
    .in('status', ['active', 'accepted'])
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ matter: data })
}
