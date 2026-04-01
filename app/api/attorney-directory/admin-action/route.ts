import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // ── 1. Auth + admin check ──────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.is_admin !== true) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── 2. Parse body ──────────────────────────────────────────
  const { listing_id, action } = await req.json()

  if (!listing_id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json(
      { error: 'listing_id and action (approve|reject) are required' },
      { status: 400 }
    )
  }

  // ── 3. Fetch listing + nominating advisor ──────────────────
  const { data: listing } = await supabase
    .from('attorney_listings')
    .select('id, contact_name, firm_name, email, submitted_by')
    .eq('id', listing_id)
    .single()

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }

  // Get nominating advisor email
  const { data: advisorProfile } = listing.submitted_by
    ? await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', listing.submitted_by)
        .single()
    : { data: null }

  // ── 4. Approve — set is_active + is_verified ───────────────
  if (action === 'approve') {
    const { error: updateError } = await supabase
      .from('attorney_listings')
      .update({ is_active: true, is_verified: true })
      .eq('id', listing_id)

    if (updateError) {
      console.error('approve update error:', updateError)
      return NextResponse.json({ error: 'Failed to approve listing' }, { status: 500 })
    }

    // Email attorney
    if (listing.email) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to:      listing.email,
            bcc:     'avoels@comcast.net',
            subject: 'Your attorney listing has been approved — EstatePlanner',
            html: `
              <p>Hi ${listing.contact_name ?? 'there'},</p>
              <p>Your listing for <strong>${listing.firm_name}</strong> has been approved
              and is now live in the EstatePlanner attorney directory.</p>
              <p>Consumers can now find your listing and request to connect with you.</p>
              <p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/attorney-directory">
                View the Attorney Directory
              </a></p>
            `,
          }),
        })
      } catch (e) {
        console.error('approve attorney email error:', e)
      }
    }

    // Email nominating advisor
    if (advisorProfile?.email) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to:      advisorProfile.email,
            bcc:     'avoels@comcast.net',
            subject: 'Attorney nomination approved — EstatePlanner',
            html: `
              <p>Hi ${advisorProfile.full_name ?? 'there'},</p>
              <p>The attorney you nominated — <strong>${listing.firm_name}</strong> —
              has been approved and is now live in the directory.</p>
              <p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/attorney-directory">
                View the Attorney Directory
              </a></p>
            `,
          }),
        })
      } catch (e) {
        console.error('approve advisor email error:', e)
      }
    }

    return NextResponse.json({ success: true, action: 'approved' })
  }

  // ── 5. Reject — hard delete the listing ───────────────────
  if (action === 'reject') {
    const { error: deleteError } = await supabase
      .from('attorney_listings')
      .delete()
      .eq('id', listing_id)

    if (deleteError) {
      console.error('reject delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to reject listing' }, { status: 500 })
    }

    // Email attorney
    if (listing.email) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to:      listing.email,
            bcc:     'avoels@comcast.net',
            subject: 'Your attorney listing was not approved — EstatePlanner',
            html: `
              <p>Hi ${listing.contact_name ?? 'there'},</p>
              <p>Thank you for your interest in joining the EstatePlanner attorney directory.
              Unfortunately your listing for <strong>${listing.firm_name}</strong> was not
              approved at this time.</p>
              <p>If you have questions, please reply to this email.</p>
            `,
          }),
        })
      } catch (e) {
        console.error('reject attorney email error:', e)
      }
    }

    // Email nominating advisor
    if (advisorProfile?.email) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to:      advisorProfile.email,
            bcc:     'avoels@comcast.net',
            subject: 'Attorney nomination not approved — EstatePlanner',
            html: `
              <p>Hi ${advisorProfile.full_name ?? 'there'},</p>
              <p>The attorney you nominated — <strong>${listing.firm_name}</strong> —
              was not approved for the directory at this time.</p>
              <p>If you have questions, please contact support.</p>
            `,
          }),
        })
      } catch (e) {
        console.error('reject advisor email error:', e)
      }
    }

    return NextResponse.json({ success: true, action: 'rejected' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
