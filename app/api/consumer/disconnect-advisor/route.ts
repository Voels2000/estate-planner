import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import { restoreConsumerBillingOnDisconnect } from '@/lib/advisor/restoreConsumerBillingOnDisconnect'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: connection } = await admin
    .from('advisor_clients')
    .select('id, advisor_id, client_id')
    .eq('client_id', user.id)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
    .maybeSingle()

  if (!connection) {
    return NextResponse.json({ error: 'No active advisor connection found' }, { status: 404 })
  }

  const { error: updateError } = await admin
    .from('advisor_clients')
    .update({
      status: 'removed',
      client_status: 'inactive',
    })
    .eq('id', connection.id)

  if (updateError) {
    console.error('disconnect-advisor update:', updateError)
    return NextResponse.json({ error: 'Failed to disconnect advisor' }, { status: 500 })
  }

  const billing = await restoreConsumerBillingOnDisconnect(admin, {
    clientId: user.id,
    advisorClientRowId: connection.id,
    advisorId: connection.advisor_id,
    sendEmail: true,
  })

  return NextResponse.json({
    success: true,
    restored_tier: billing.restoredTier,
    stripe_resumed: billing.stripeResumed,
  })
}
