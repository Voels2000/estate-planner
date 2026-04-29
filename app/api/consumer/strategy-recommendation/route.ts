/**
 * Consumer strategy recommendation accept / reject API.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function resolveHousehold(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', userId)
    .single()
  return data
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lineItemId, householdId } = (await request.json()) as {
    lineItemId?: string
    householdId?: string
  }
  if (!lineItemId || !householdId) {
    return NextResponse.json({ error: 'lineItemId and householdId required' }, { status: 400 })
  }

  const household = await resolveHousehold(supabase, user.id)
  if (!household || household.id !== householdId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('strategy_line_items')
    .update({
      consumer_accepted: true,
      consumer_rejected: false,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', lineItemId)
    .eq('household_id', householdId)
    .eq('source_role', 'advisor')

  if (error) {
    console.error('[consumer/strategy-recommendation:accept]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  try {
    const { triggerEstateHealthRecompute } = await import('@/lib/estate/triggerEstateHealthRecompute')
    triggerEstateHealthRecompute(householdId, process.env.NEXT_PUBLIC_APP_URL ?? '')
  } catch (err) {
    console.error('[consumer/strategy-recommendation] recompute trigger failed', err)
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lineItemId, householdId } = (await request.json()) as {
    lineItemId?: string
    householdId?: string
  }
  if (!lineItemId || !householdId) {
    return NextResponse.json({ error: 'lineItemId and householdId required' }, { status: 400 })
  }

  const household = await resolveHousehold(supabase, user.id)
  if (!household || household.id !== householdId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('strategy_line_items')
    .update({
      consumer_rejected: true,
      consumer_accepted: false,
    })
    .eq('id', lineItemId)
    .eq('household_id', householdId)
    .eq('source_role', 'advisor')

  if (error) {
    console.error('[consumer/strategy-recommendation:reject]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
