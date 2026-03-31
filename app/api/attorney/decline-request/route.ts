import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const admin = createAdminClient()

  // 1. Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Attorney check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_attorney, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'attorney' && !profile.is_attorney)) {
    return NextResponse.json({ error: 'Attorney access required' }, { status: 403 })
  }

  // 3. Parse body
  const { attorney_client_id } = await request.json()
  if (!attorney_client_id) {
    return NextResponse.json({ error: 'attorney_client_id is required' }, { status: 400 })
  }

  // 4. Fetch the request row
  const { data: row, error: fetchError } = await admin
    .from('attorney_clients')
    .select('id, client_id')
    .eq('id', attorney_client_id)
    .eq('attorney_id', user.id)
    .eq('status', 'consumer_requested')
    .single()

  if (fetchError || !row) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  // 5. Soft delete
  const { error: updateError } = await admin
    .from('attorney_clients')
    .update({ status: 'removed' })
    .eq('id', row.id)

  if (updateError) {
    console.error('Update error:', updateError)
    return NextResponse.json({ error: 'Failed to decline request' }, { status: 500 })
  }

  // 6. Notify consumer in-app (fire-and-forget)
  const attorneyLabel = profile.full_name?.trim() || 'The attorney'
  ;(async () => {
    try {
      await admin.rpc('create_notification', {
        p_user_id: row.client_id,
        p_type: 'consumer_connection_declined',
        p_title: 'Connection request declined',
        p_body: `${attorneyLabel} was unable to take on new clients at this time.`,
        p_delivery: 'in_app',
        p_metadata: { attorney_client_id },
        p_cooldown: '1 hour',
      })
    } catch {}
  })()

  return NextResponse.json({ success: true })
}
