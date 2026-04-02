import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // ── 1. Auth check ──────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse body ──────────────────────────────────────────
  const { attorney_id } = await req.json()
  if (!attorney_id) {
    return NextResponse.json({ error: 'attorney_id is required' }, { status: 400 })
  }

  // ── 3. Get consumer's household ────────────────────────────
  const { data: household, error: householdError } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (householdError || !household) {
    return NextResponse.json({ error: 'Household not found' }, { status: 404 })
  }

  // ── 4. Check for existing active connection ─────────────────
  const { data: existing } = await supabase
    .from('attorney_clients')
    .select('id, status')
    .eq('attorney_id', attorney_id)
    .eq('client_id', household.id)
    .in('status', ['active', 'accepted', 'pending'])
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'An active or pending connection already exists with this attorney' },
      { status: 409 }
    )
  }

  // ── 5. Write the connection ─────────────────────────────────
  const now = new Date().toISOString()

  const { data: connection, error: insertError } = await supabase
    .from('attorney_clients')
    .insert({
      attorney_id,
      client_id: household.id,
      status: 'active',
      granted_at: now,
      granted_by: user.id,
    })
    .select()
    .single()

  if (insertError) {
    console.error('grant-access insert error:', insertError)
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
  }

  // ── 6. Get attorney listing and consumer profile ────────────
  const { data: attorneyListing } = await supabase
    .from('attorney_listings')
    .select('email, contact_name')
    .eq('attorney_id', attorney_id)
    .single()

  const { data: consumerProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  // ── 7. Send email to attorney (non-fatal) ───────────────────
  // Check if attorney already has a platform account.
  // New attorneys get an invite email with a signup link pre-filled with their role.
  // Existing attorneys get a notification-only email — no magic link per security policy.
  if (attorneyListing?.email) {
    try {
      const { data: attorneyProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', attorneyListing.email)
        .maybeSingle()

      const hasAccount = !!attorneyProfile

      if (hasAccount) {
        // Existing attorney — notification only, login CTA
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/email/attorney-notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: attorneyListing.email,
            attorneyName: attorneyListing.contact_name ?? null,
            consumerName: consumerProfile?.full_name ?? 'A client',
          }),
        })
      } else {
        // New attorney — invite with signup link pre-filled as attorney role.
        // Connection token embeds the connection id so the portal pre-associates
        // them to this consumer on first login.
        const signupUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/signup?role=attorney&connectionToken=${connection.id}&email=${encodeURIComponent(attorneyListing.email)}`

        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/email/attorney-invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: attorneyListing.email,
            attorneyName: attorneyListing.contact_name ?? null,
            consumerName: consumerProfile?.full_name ?? 'A client',
            signupUrl,
          }),
        })
      }
    } catch (emailError) {
      console.error('grant-access email error:', emailError)
    }
  }

  // ── 8. Write in-app notification to attorney ────────────────
  try {
    await supabase.from('notifications').insert({
      user_id: attorney_id,
      type: 'attorney_access_granted',
      title: 'New client access granted',
      body: `${consumerProfile?.full_name ?? 'A client'} has granted you access to their estate plan.`,
      delivery: 'in_app',
      read: false,
    })
  } catch (notifyError) {
    console.error('grant-access notification error:', notifyError)
  }

  // ── 9. Return success ───────────────────────────────────────
  return NextResponse.json({
    success: true,
    connection_id: connection.id,
    granted_at: now,
  })
}
