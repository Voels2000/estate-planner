import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // ── 1. Auth check ──────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse body ──────────────────────────────────────────
  const { connection_id } = await req.json()
  if (!connection_id) {
    return NextResponse.json({ error: 'connection_id is required' }, { status: 400 })
  }

  // ── 3. Fetch the connection ─────────────────────────────────
  const { data: connection, error: fetchError } = await supabase
    .from('attorney_clients')
    .select('id, attorney_id, client_id, status')
    .eq('id', connection_id)
    .single()

  if (fetchError || !connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  // ── 4. Confirm caller is a party to this connection ─────────
  // Get the caller's household to check if they are the consumer
  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  const isConsumer = household?.id === connection.client_id
  const isAttorney = user.id === connection.attorney_id

  if (!isConsumer && !isAttorney) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── 5. Check connection is currently active ─────────────────
  if (!['active', 'accepted'].includes(connection.status)) {
    return NextResponse.json(
      { error: 'Connection is not active and cannot be revoked' },
      { status: 409 }
    )
  }

  // ── 6. Write revocation ─────────────────────────────────────
  const now = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('attorney_clients')
    .update({
      status:     'revoked',
      revoked_at: now,
      revoked_by: user.id,
    })
    .eq('id', connection_id)

  if (updateError) {
    console.error('revoke-access update error:', updateError)
    return NextResponse.json({ error: 'Failed to revoke connection' }, { status: 500 })
  }

  // ── 7. Get profiles for notifications ──────────────────────
  // Notify the OTHER party — whoever didn't revoke
  const notifyUserId = isConsumer ? connection.attorney_id : connection.client_id

  const { data: revokerProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  // If attorney revoked, we need the consumer's profile via household
  // If consumer revoked, we need the attorney's profile directly
  let notifyEmail: string | null = null
  let notifyName: string | null = null

  if (isConsumer) {
    // Notify attorney — get from attorney_listings
    const { data: attorneyListing } = await supabase
      .from('attorney_listings')
      .select('email, contact_name')
      .eq('attorney_id', connection.attorney_id)
      .single()
    notifyEmail = attorneyListing?.email ?? null
    notifyName  = attorneyListing?.contact_name ?? null
  } else {
    // Notify consumer — get from profiles via household owner
    const { data: consumerHousehold } = await supabase
      .from('households')
      .select('owner_id')
      .eq('id', connection.client_id)
      .single()

    if (consumerHousehold?.owner_id) {
      const { data: consumerProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', consumerHousehold.owner_id)
        .single()
      notifyEmail = consumerProfile?.email ?? null
      notifyName  = consumerProfile?.full_name ?? null
    }
  }

  // ── 8. Send email to other party (non-fatal) ────────────────
  if (notifyEmail) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to:      notifyEmail,
          bcc:     'avoels@comcast.net',
          subject: 'Attorney access has been revoked on EstatePlanner',
          html: `
            <p>Hi ${notifyName ?? 'there'},</p>
            <p><strong>${revokerProfile?.full_name ?? 'A user'}</strong> has revoked 
            attorney access on EstatePlanner.</p>
            <p>Any documents already uploaded remain safely stored in the client vault.</p>
            <p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard">Go to Dashboard</a></p>
          `,
        }),
      })
    } catch (emailError) {
      console.error('revoke-access email error:', emailError)
    }
  }

  // ── 9. Write in-app notification to other party (non-fatal) ─
  try {
    await supabase.from('notifications').insert({
      user_id:  notifyUserId,
      type:     'attorney_access_revoked',
      title:    'Attorney access revoked',
      body:     `${revokerProfile?.full_name ?? 'A user'} has revoked attorney portal access.`,
      delivery: 'in_app',
      read:     false,
    })
  } catch (notifyError) {
    console.error('revoke-access notification error:', notifyError)
  }

  // ── 10. Return success ──────────────────────────────────────
  return NextResponse.json({
    success:    true,
    revoked_at: now,
    revoked_by: user.id,
  })
}
