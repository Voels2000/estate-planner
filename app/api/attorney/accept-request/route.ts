import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { generateInviteToken, tokenExpiresAt } from '@/lib/invite-token'
import { resend } from '@/lib/resend'

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
    .select('id, client_id, status')
    .eq('id', attorney_client_id)
    .eq('attorney_id', user.id)
    .eq('status', 'consumer_requested')
    .single()

  if (fetchError || !row) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  // 5. Fetch consumer profile
  const { data: consumer } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', row.client_id)
    .single()

  if (!consumer?.email) {
    return NextResponse.json({ error: 'Consumer profile not found' }, { status: 404 })
  }

  // 6. Generate invite token
  const token = generateInviteToken()
  const expiresAt = tokenExpiresAt()

  // 7. Update row to pending + store token
  const { error: updateError } = await admin
    .from('attorney_clients')
    .update({
      status: 'pending',
      invite_token: token,
      invite_expires_at: expiresAt.toISOString(),
    })
    .eq('id', row.id)

  if (updateError) {
    console.error('Update error:', updateError)
    return NextResponse.json({ error: 'Failed to accept request' }, { status: 500 })
  }

  // 8. Send invite email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const acceptUrl = `${appUrl}/attorney-invite/${token}`
  const attorneyLabel = profile.full_name?.trim() || 'Your attorney'

  ;(async () => {
    try {
      await resend.emails.send({
        from: 'MyWealthMaps <noreply@mywealthmaps.com>',
        headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
        tags: [{ name: 'category', value: 'attorney_invite' }],
        to: consumer.email,
        subject: `${attorneyLabel} accepted your connection request`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
            <h1 style="color:#1a1a2e;font-size:24px">MyWealthMaps</h1>
            <p style="color:#6b7280;font-size:14px">Financial, Retirement &amp; Estate Planning in One Place</p>
            <div style="background:#f9fafb;border-radius:8px;padding:32px;margin:24px 0">
              <h2 style="color:#1a1a2e;font-size:20px;margin-top:0">Your request was accepted</h2>
              <p style="color:#374151;font-size:16px;line-height:1.6"><strong>${attorneyLabel}</strong> has accepted your request to connect on MyWealthMaps.</p>
              <p style="color:#374151;font-size:16px;line-height:1.6">Click below to confirm the connection and get started.</p>
              <div style="text-align:center;margin:32px 0">
                <a href="${acceptUrl}" style="background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">Accept Invitation</a>
              </div>
              <p style="color:#6b7280;font-size:14px;text-align:center">This link expires in 7 days.</p>
            </div>
            <p style="color:#9ca3af;font-size:12px;text-align:center">If you did not expect this email, you can safely ignore it.</p>
          </div>
        `,
      })
    } catch (err) {
      console.error('Invite email error:', err)
    }
  })()

  return NextResponse.json({ success: true })
}
