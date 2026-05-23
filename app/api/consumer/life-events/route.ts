import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
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

  void notifyAdvisorOfLifeEvent(supabase, user.id, eventType, data.id)

  return NextResponse.json({ ok: true, id: data.id, event: data })
}

async function notifyAdvisorOfLifeEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  eventType: string,
  lifeEventId: string,
) {
  try {
    const { data: connection } = await supabase
      .from('advisor_clients')
      .select('advisor_id')
      .eq('client_id', userId)
      .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
      .maybeSingle()

    if (!connection?.advisor_id) return

    const { data: clientProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single()

    const clientName = clientProfile?.full_name ?? clientProfile?.email ?? 'Your client'

    const eventLabel = eventType
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

    const { createAdminClient } = await import('@/lib/supabase/admin')
    const adminClient = createAdminClient()

    await adminClient.rpc('create_notification', {
      p_user_id: connection.advisor_id,
      p_type: 'client_life_event',
      p_title: `${clientName} logged a life event`,
      p_body: `${clientName} indicated: ${eventLabel}. Review their plan to see what may need attention.`,
      p_delivery: 'both',
      p_metadata: {
        client_id: userId,
        life_event_id: lifeEventId,
        event_type: eventType,
        event_label: eventLabel,
      },
      p_cooldown: '1 hour',
    })
  } catch (err) {
    console.error('notifyAdvisorOfLifeEvent error:', err)
  }
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
