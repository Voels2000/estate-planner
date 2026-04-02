import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

  // ── 2. Consumer role check ─────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile || !['consumer', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Only consumers can request attorneys' }, { status: 403 })
  }

  // ── 3. Parse and validate body ─────────────────────────────
  const { contact_name, firm_name, email, note } = await req.json()

  if (!contact_name || !firm_name || !email) {
    return NextResponse.json(
      { error: 'contact_name, firm_name, and email are required' },
      { status: 400 }
    )
  }

  const emailLower = email.trim().toLowerCase()

  // ── 4. Check for duplicate listing by email ────────────────
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('attorney_listings')
    .select('id, is_active')
    .eq('email', emailLower)
    .maybeSingle()

  if (existing) {
    if (existing.is_active) {
      return NextResponse.json(
        { error: 'This attorney is already listed in the directory.' },
        { status: 409 }
      )
    } else {
      // Already requested but not yet active — don't create a duplicate
      return NextResponse.json(
        { error: 'This attorney has already been requested and their invitation is pending.' },
        { status: 409 }
      )
    }
  }

  // ── 5. Create the listing ──────────────────────────────────
  const { data: listing, error: insertError } = await admin
    .from('attorney_listings')
    .insert({
      contact_name: contact_name.trim(),
      firm_name: firm_name.trim(),
      email: emailLower,
      is_active: false,
      is_verified: false,
      requested_by: user.id,
    })
    .select()
    .single()

  if (insertError) {
    console.error('request-add insert error:', insertError)
    return NextResponse.json({ error: 'Failed to create listing' }, { status: 500 })
  }

  // ── 6. Send invite email to attorney ──────────────────────
  try {
    const signupUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/signup?role=attorney&email=${encodeURIComponent(emailLower)}`

    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/email/attorney-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailLower,
        attorneyName: contact_name.trim(),
        consumerName: profile.full_name ?? 'A client',
        signupUrl,
        note: note?.trim() ?? null,
      }),
    })
  } catch (emailError) {
    console.error('request-add invite email error:', emailError)
    // Non-fatal — listing is created, email failure should not block the response
  }

  // ── 7. Return success ──────────────────────────────────────
  return NextResponse.json({
    success: true,
    listing_id: listing.id,
    message: 'Attorney invitation sent. You will be notified when they join the platform.',
  })
}
