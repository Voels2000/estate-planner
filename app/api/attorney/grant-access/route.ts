import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { user, isSuperuser, isConsumer } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperuser && !isConsumer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()

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
    return NextResponse.json(
      {
        error:
          'Household not found: no household record for this account. Complete your profile setup before connecting with an attorney.',
      },
      { status: 404 }
    )
  }

  // ── 4. Fetch attorney listing up front ─────────────────────
  // attorney_id is attorney_listings.id (the listing PK).
  // attorney_listings.attorney_id is null across all rows — never use it.
  // profile_id is the FK to auth.users for the attorney's platform account.
  const { data: attorneyListing, error: listingError } = await supabase
    .from('attorney_listings')
    .select('id, email, contact_name, profile_id')
    .eq('id', attorney_id)
    .single()

  if (listingError || !attorneyListing) {
    return NextResponse.json({ error: 'Attorney listing not found' }, { status: 404 })
  }

  // ── 5. Check for existing active connection ─────────────────
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

  // ── 6. Write the connection ─────────────────────────────────
  const now = new Date().toISOString()

  const { data: connection, error: insertError } = await supabase
    .from('attorney_clients')
    .insert({
      attorney_id,               // attorney_listings.id — correct FK per Sprint 38 locked decision
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

  // ── 7. Get consumer profile ─────────────────────────────────
  const { data: consumerProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  // ── 8. Send email to attorney (non-fatal) ───────────────────
  if (attorneyListing.email) {
    try {
      // profile_id is set if the attorney has a platform account; null if not yet signed up.
      const hasAccount = !!attorneyListing.profile_id

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
        // New attorney — invite with signup link
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

  // ── 9. Write in-app notification to attorney ────────────────
  // Only send if the attorney has a platform account (profile_id exists).
  // If no account yet, there is no user to notify in-app.
  if (attorneyListing.profile_id) {
    try {
      await supabase.from('notifications').insert({
        user_id: attorneyListing.profile_id,   // auth.users id, not listing id
        type: 'attorney_access_granted',
        title: 'New client access granted',
        body: `${consumerProfile?.full_name ?? 'A client'} has granted you access to their estate plan.`,
        delivery: 'in_app',
        read: false,
      })
    } catch (notifyError) {
      console.error('grant-access notification error:', notifyError)
    }
  }

  // ── 10. Return success ──────────────────────────────────────
  if (isSuperuser) {
    const admin = createAdminClient()
    await admin.from('superuser_action_log').insert({
      user_id: user.id,
      endpoint: '/api/attorney/grant-access',
      target_id: attorney_id,
      action: 'grant-access',
    })
  }
  return NextResponse.json({
    success: true,
    connection_id: connection.id,
    granted_at: now,
  })
}
