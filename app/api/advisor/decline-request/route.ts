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

  // 2. Advisor role check
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
    .select('id, client_id, invited_email, profiles(email)')
    .eq('id', advisor_client_id)
    .eq('advisor_id', user.id)
    .eq('status', 'consumer_requested')
    .single()

  if (fetchError || !row) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  // 5. Write declined status with audit fields
  const { error: updateError } = await admin
    .from('advisor_clients')
    .update({
      status: 'declined',
      declined_at: new Date().toISOString(),
      declined_by: user.id,
    })
    .eq('id', row.id)

  if (updateError) {
    console.error('decline update error:', updateError)
    return NextResponse.json({ error: 'Failed to decline request' }, { status: 500 })
  }

  // 6. Background: in-app notification + email (both non-fatal)
  const advisorLabel = profile.full_name?.trim() || 'The advisor'
  const prof = row.profiles as { email: string } | { email: string }[] | null
  const consumerEmail =
    (Array.isArray(prof) ? prof[0]?.email : prof?.email) ?? row.invited_email

  ;(async () => {
    try {
      // In-app notification to consumer
      await admin.rpc('create_notification', {
        p_user_id: row.client_id,
        p_type: 'consumer_connection_declined',
        p_title: 'Connection request declined',
        p_body: `${advisorLabel} was unable to take on new clients at this time.`,
        p_delivery: 'in_app',
        p_metadata: { advisor_client_id },
        p_cooldown: '1 hour',
      })
    } catch (err) {
      console.error('decline: in-app notification failed', err)
    }

    // Email to consumer, BCC to admin for visibility
    if (consumerEmail) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to: consumerEmail,
            bcc: 'avoels@comcast.net',
            subject: 'Your advisor connection request was not accepted',
            text: `Hi,\n\n${advisorLabel} was unable to take on new clients at this time and has declined your request.\n\nYou can return to the platform to connect with a different advisor.\n\n${process.env.NEXT_PUBLIC_APP_URL}/advisors\n\nThe Estate Planner Team`,
          }),
        })
      } catch (emailErr) {
        console.error('decline: email send failed', emailErr)
      }
    }
  })()

  return NextResponse.json({ success: true })
}
