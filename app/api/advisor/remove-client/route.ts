import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'advisor' && profile?.is_admin !== true) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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

  if (record.billing_transferred && record.client_id) {
    await admin
      .from('profiles')
      .update({ consumer_tier: record.previous_consumer_tier ?? 1 })
      .eq('id', record.client_id)
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
    ;(async () => {
      try {
        await admin.rpc('create_notification', {
          p_user_id: record.client_id,
          p_type: 'advisor_viewed',
          p_title: 'Advisor connection ended',
          p_body: 'Your advisor has removed you from their practice. Your subscription has been reverted.',
          p_delivery: 'both',
          p_metadata: { advisor_id: user.id },
          p_cooldown: '1 hour',
        })
      } catch (err) {
        console.error('remove-client notification:', err)
      }
    })()
  }

  return NextResponse.json({ success: true })
}
