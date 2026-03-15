import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()

    // Find any pending invites for this email
    const { data: pendingInvites } = await adminClient
      .from('advisor_clients')
      .select('id')
      .eq('invited_email', user.email!.toLowerCase())
      .is('client_id', null)

    if (!pendingInvites || pendingInvites.length === 0) {
      return NextResponse.json({ linked: false })
    }

    // Link them all (could be invited by multiple advisors)
    const { error } = await adminClient
      .from('advisor_clients')
      .update({
        client_id: user.id,
        accepted_at: new Date().toISOString(),
        client_status: 'active',
      })
      .eq('invited_email', user.email!.toLowerCase())
      .is('client_id', null)

    if (error) throw error

    return NextResponse.json({ linked: true, count: pendingInvites.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    console.error('Link pending error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
