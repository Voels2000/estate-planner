import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find any pending invite for this email
    const { data: invite } = await supabase
      .from('advisor_clients')
      .select('id, invite_expires_at')
      .eq('invited_email', user.email)
      .eq('status', 'pending')
      .maybeSingle()

    if (!invite) {
      return NextResponse.json({ linked: false })
    }

    // Check not expired
    if (new Date(invite.invite_expires_at) < new Date()) {
      return NextResponse.json({ linked: false, reason: 'expired' })
    }

    // Link the new user to their advisor
    const { error } = await supabase
      .from('advisor_clients')
      .update({
        client_id: user.id,
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', invite.id)

    if (error) {
      console.error('Link error:', error)
      return NextResponse.json({ error: 'Failed to link invite' }, { status: 500 })
    }

    return NextResponse.json({ linked: true })

  } catch (err) {
    console.error('Link-pending error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
