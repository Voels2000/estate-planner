import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { restoreConsumerBillingOnDisconnect } from '@/lib/advisor/restoreConsumerBillingOnDisconnect'

export async function DELETE(req: NextRequest) {
  const { user, isSuperuser, isAdvisor } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperuser && !isAdvisor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { advisor_client_id?: string }
  if (!body.advisor_client_id) {
    return NextResponse.json({ error: 'advisor_client_id is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: record, error: fetchError } = await admin
    .from('advisor_clients')
    .select('id, client_id, billing_transferred, previous_consumer_tier, advisor_id')
    .eq('id', body.advisor_client_id)
    .eq('advisor_id', user.id)
    .single()

  if (fetchError || !record) {
    return NextResponse.json({
      error: 'Client record not found',
      detail: fetchError?.message,
      advisor_client_id: body.advisor_client_id,
      advisor_id: user.id,
    }, { status: 404 })
  }

  if (record.client_id) {
    const { data: household } = await admin
      .from('households')
      .select('id')
      .eq('owner_id', record.client_id)
      .maybeSingle()

    if (household?.id) {
      await admin
        .from('beneficiary_access_grants')
        .update({
          revoked_at: new Date().toISOString(),
          revoked_by_user_id: user.id,
        })
        .eq('household_id', household.id)
        .is('revoked_at', null)
    }
  }

  const { error: updateError } = await admin
    .from('advisor_clients')
    .update({
      status: 'removed',
      client_status: 'inactive',
    })
    .eq('id', body.advisor_client_id)

  if (updateError) {
    console.error('remove-client:', updateError)
    return NextResponse.json({ error: 'Failed to remove client' }, { status: 500 })
  }

  if (record.client_id) {
    await restoreConsumerBillingOnDisconnect(admin, {
      clientId: record.client_id,
      advisorClientRowId: record.id,
      advisorId: user.id,
      sendEmail: true,
    })
  }

  if (isSuperuser) {
    await admin.from('superuser_action_log').insert({
      user_id: user.id,
      endpoint: '/api/advisor/remove-client',
      target_id: body.advisor_client_id,
      action: 'remove-client',
    })
  }

  return NextResponse.json({ success: true })
}
