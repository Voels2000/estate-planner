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

  // ── 2. Confirm caller is an advisor ────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || profile?.role !== 'advisor') {
    return NextResponse.json({ error: 'Forbidden — advisors only' }, { status: 403 })
  }

  // ── 3. Parse and validate body ─────────────────────────────
  const {
    firm_name,
    contact_name,
    email,
    phone,
    website,
    city,
    state,
    bio,
    specializations,
    bar_number,
    states_licensed,
    serves_remote,
    languages,
    fee_structure,
  } = await req.json()

  // Required fields
  if (!contact_name || !email || !state) {
    return NextResponse.json(
      { error: 'contact_name, email, and state are required' },
      { status: 400 }
    )
  }

  // ── 4. Check if this email is already in the directory ──────
  const { data: existing } = await supabase
    .from('attorney_listings')
    .select('id, is_verified, is_active')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      {
        error: 'An attorney with this email already exists in the directory',
        listing_id: existing.id,
        is_verified: existing.is_verified,
        is_active: existing.is_active,
      },
      { status: 409 }
    )
  }

  // ── 5. Write the nomination ─────────────────────────────────
  const { data: listing, error: insertError } = await supabase
    .from('attorney_listings')
    .insert({
      firm_name: firm_name ?? null,
      contact_name,
      email,
      phone: phone ?? null,
      website: website ?? null,
      city: city ?? null,
      state,
      bio: bio ?? null,
      specializations: specializations ?? [],
      bar_number: bar_number ?? null,
      states_licensed: states_licensed ?? [],
      serves_remote: serves_remote ?? false,
      languages: languages ?? [],
      fee_structure: fee_structure ?? null,
      submitted_by: user.id,
      is_active: false, // not live until admin approves
      is_verified: false, // not verified until admin reviews
    })
    .select()
    .single()

  if (insertError) {
    console.error('nominate insert error:', insertError)
    return NextResponse.json({ error: 'Failed to submit nomination' }, { status: 500 })
  }

  // ── 6. Notify admin (non-fatal) ─────────────────────────────
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'avoels@comcast.net',
        subject: 'New attorney nomination submitted — EstatePlanner',
        html: `
          <p>A new attorney has been nominated to the directory.</p>
          <ul>
            <li><strong>Name:</strong> ${contact_name}</li>
            <li><strong>Firm:</strong> ${firm_name ?? 'N/A'}</li>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>State:</strong> ${state}</li>
            <li><strong>Nominated by advisor:</strong> ${user.id}</li>
          </ul>
          <p>Log in to the admin portal to review and approve this listing.</p>
          <p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/admin/attorney-listings">
            Review Nomination
          </a></p>
        `,
      }),
    })
  } catch (emailError) {
    console.error('nominate admin email error:', emailError)
  }

  // ── 7. Return success ───────────────────────────────────────
  return NextResponse.json({
    success: true,
    listing_id: listing.id,
    message:
      'Nomination submitted. The attorney will appear in the directory once approved by an admin.',
  })
}
