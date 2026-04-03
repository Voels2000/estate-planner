import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, isSuperuser, isAdvisor } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperuser && !isAdvisor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile || (!isSuperuser && profile.role !== 'advisor')) {
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
    .select('id, client_id, status')
    .eq('id', advisor_client_id)
    .eq('advisor_id', user.id)
    .eq('status', 'consumer_requested')
    .single()

  if (fetchError || !row) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  // 5. Fetch consumer profile for the invite email
  const { data: consumer } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', row.client_id)
    .single()

  if (!consumer?.email) {
    return NextResponse.json({ error: 'Consumer profile not found' }, { status: 404 })
  }

  // 6. Generate invite token — same pattern as advisor-initiated flow
  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

  // 7. Update the advisor_clients row to pending + store token
  const { error: updateError } = await admin
    .from('advisor_clients')
    .update({
      status: 'pending',
      invite_token: token,
      invite_expires_at: expiresAt,
    })
    .eq('id', row.id)

  if (updateError) {
    console.error('Update error:', updateError)
    return NextResponse.json({ error: 'Failed to accept request' }, { status: 500 })
  }

  // 8. Send invite email via existing Resend setup
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`
  const advisorLabel = profile.full_name?.trim() || profile.email || 'Your advisor'

  ;(async () => {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'hello@mywealthmaps.com',
        to: consumer.email,
        subject: `${advisorLabel} accepted your connection request`,
        html: `
          <p>Hi ${consumer.full_name?.trim() || 'there'},</p>
          <p><strong>${advisorLabel}</strong> has accepted your request to connect on Wealth Maps.</p>
          <p>Click below to confirm the connection and unlock your Estate Planning features:</p>
          <p><a href="${inviteUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Accept Invitation</a></p>
          <p>This link expires in 7 days.</p>
          <p>— The Wealth Maps Team</p>
        `,
      })
    } catch (err) {
      console.error('Invite email error:', err)
    }
  })()

  if (isSuperuser) {
    await admin.from('superuser_action_log').insert({
      user_id: user.id,
      endpoint: '/api/advisor/accept-request',
      target_id: advisor_client_id,
      action: 'accept-request',
    })
  }

  return NextResponse.json({ success: true })
}
