import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { request_id } = await req.json()
  if (!request_id) {
    return NextResponse.json({ error: 'request_id is required' }, { status: 400 })
  }

  const { data: existing } = await admin
    .from('connection_requests')
    .select('id, consumer_id, status')
    .eq('id', request_id)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  if (existing.consumer_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  if (existing.status !== 'pending') {
    return NextResponse.json(
      { error: 'Only pending requests can be cancelled' },
      { status: 409 }
    )
  }

  const { error } = await admin
    .from('connection_requests')
    .update({ status: 'cancelled' })
    .eq('id', request_id)

  if (error) {
    console.error('cancel connection request:', error)
    return NextResponse.json({ error: 'Failed to cancel request' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
