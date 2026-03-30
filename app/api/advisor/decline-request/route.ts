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

  // 2. Advisor check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'advisor') {
    return NextResponse.json({ error: 'Advisor access required' }, { status: 403 })
  }

  // 3. Parse body
  const { advisor_client_id } = await request.json()
  if (!advisor_client_id) {
    return NextResponse.json({ error: 'advisor_client_id is required' }, { status: 400 })
  }

  // 4. Fetch the request row — must belong to this advisor and be consumer_requested
  const { data: row, error: fetchError } = await admin
    .from('advisor_clients')
    .select('id, client_id')
    .eq('id', advisor_client_id)
    .eq('advisor_id', user.id)
    .eq('status', 'consumer_requested')
    .single()

  if (fetchError || !row) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  // 5. Soft delete — set status to removed
  const { error: updateError } = await admin
    .from('advisor_clients')
    .update({ status: 'removed' })
    .eq('id', row.id)

  if (updateError) {
    console.error('Update error:', updateError)
    return NextResponse.json({ error: 'Failed to decline request' }, { status: 500 })
  }

  // 6. Notify consumer in-app (fire-and-forget)
  const advisorLabel = profile.full_name?.trim() || 'The advisor'
  ;(async () => {
    try {
      await admin.rpc('create_notification', {
        p_user_id: row.client_id,
        p_type: 'consumer_connection_declined',
        p_title: 'Connection request declined',
        p_body: `${advisorLabel} was unable to take on new clients at this time.`,
        p_delivery: 'in_app',
        p_metadata: { advisor_client_id },
        p_cooldown: '1 hour',
      })
    } catch {}
  })()

  return NextResponse.json({ success: true })
}
