import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, isAdvisor } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdvisor) return NextResponse.json({ error: 'Advisor access required' }, { status: 403 })

  const { token } = await request.json()
  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const supabase = await createClient()

  const { data: row } = await admin
    .from('advisor_clients')
    .select('id, client_id, invited_email, status, invite_expires_at, advisor_id')
    .eq('invite_token', token)
    .eq('status', 'consumer_requested')
    .maybeSingle()

  if (!row) {
    return NextResponse.json({ error: 'Invitation not found or already claimed' }, { status: 404 })
  }

  if (row.invite_expires_at && new Date(row.invite_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 })
  }

  const userEmail = user.email?.trim().toLowerCase()
  const invitedEmail = row.invited_email?.trim().toLowerCase()
  if (invitedEmail && userEmail && invitedEmail !== userEmail) {
    return NextResponse.json(
      { error: 'This invitation was sent to a different email address' },
      { status: 403 },
    )
  }

  if (row.advisor_id && row.advisor_id !== user.id) {
    return NextResponse.json({ error: 'Invitation already claimed' }, { status: 409 })
  }

  const { error: updateError } = await admin
    .from('advisor_clients')
    .update({
      advisor_id: user.id,
    })
    .eq('id', row.id)

  if (updateError) {
    console.error('claim-consumer-invite update:', updateError)
    return NextResponse.json({ error: 'Failed to claim invitation' }, { status: 500 })
  }

  const { data: consumer } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', row.client_id)
    .maybeSingle()

  try {
    await admin.rpc('create_notification', {
      p_user_id: row.client_id,
      p_type: 'consumer_connection_request_sent',
      p_title: 'Your advisor joined My Wealth Maps',
      p_body: 'Your advisor created an account and can now accept your connection request.',
      p_delivery: 'both',
      p_metadata: { advisor_id: user.id },
      p_cooldown: '1 hour',
    })
  } catch {}

  return NextResponse.json({
    success: true,
    advisor_client_id: row.id,
    consumer_name: consumer?.full_name ?? consumer?.email ?? 'Your client',
  })
}
