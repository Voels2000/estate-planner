import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { afterHouseholdWriteForOwner } from '@/lib/consumer/afterHouseholdWrite'
import { isValidLifeEventType } from '@/lib/events/lifeEventSlugs'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('life_events')
    .select('id, event_type, source, acknowledged, created_at, event_date')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ events: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const eventType = typeof body.event_type === 'string' ? body.event_type.trim() : ''
  if (!isValidLifeEventType(eventType)) {
    return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('life_events')
    .insert({
      user_id: user.id,
      event_type: eventType,
      source: 'user',
      acknowledged: false,
      event_date: body.event_date ?? null,
    })
    .select('id, event_type, source, acknowledged, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await afterHouseholdWriteForOwner(supabase, user.id)

  return NextResponse.json({ event: data })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('life_events')
    .update({ acknowledged: true })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
