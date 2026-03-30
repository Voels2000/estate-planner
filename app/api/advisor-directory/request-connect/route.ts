import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { fireAdvisorConnectionRequestNotification } from '@/lib/server-notifications'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const admin = createAdminClient()

  // 1. Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Active subscriber check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, subscription_status')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'consumer' || profile.subscription_status !== 'active') {
    return NextResponse.json({ error: 'Active subscription required' }, { status: 403 })
  }

  // 3. Parse body
  const { advisor_id, message } = await request.json()
  if (!advisor_id || !message?.trim()) {
    return NextResponse.json({ error: 'advisor_id and message are required' }, { status: 400 })
  }

  // 4. Duplicate check — block if a non-removed row already exists
  const { data: existing } = await admin
    .from('advisor_clients')
    .select('id, status')
    .eq('advisor_id', advisor_id)
    .eq('client_id', user.id)
    .neq('status', 'removed')
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'You already have a pending or active connection with this advisor' },
      { status: 409 }
    )
  }

  // 5. Insert request row
  const { data: requestRow, error: insertError } = await admin
    .from('advisor_clients')
    .insert({
      advisor_id,
      client_id: user.id,
      status: 'consumer_requested',
      request_message: message.trim(),
    })
    .select()
    .single()

  if (insertError || !requestRow) {
    console.error('Insert error:', insertError)
    return NextResponse.json({ error: 'Failed to send request' }, { status: 500 })
  }

  // 6. Fire notifications (fire-and-forget)
  ;(async () => {
    try {
      await fireAdvisorConnectionRequestNotification(requestRow.id, advisor_id, user.id)
    } catch {}
  })()

  return NextResponse.json({ success: true })
}
