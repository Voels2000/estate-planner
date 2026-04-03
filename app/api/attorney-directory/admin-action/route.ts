import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { resend } from '@/lib/resend'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { isAdmin, isSuperuser, user } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // ── 2. Parse body ──────────────────────────────────────────
  const { listing_id, action } = await req.json()

  if (!listing_id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json(
      { error: 'listing_id and action (approve|reject) are required' },
      { status: 400 }
    )
  }

  // ── 3. Fetch listing + nominating advisor ──────────────────
  const { data: listing } = await admin
    .from('attorney_listings')
    .select('id, contact_name, firm_name, email, submitted_by')
    .eq('id', listing_id)
    .single()

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }

  // Get nominating advisor email
  const { data: advisorProfile } = listing.submitted_by
    ? await admin
        .from('profiles')
        .select('full_name, email')
        .eq('id', listing.submitted_by)
        .single()
    : { data: null }

  // ── 4. Approve — set is_active + is_verified ───────────────
  if (action === 'approve') {
    const { error: updateError } = await admin
      .from('attorney_listings')
      .update({ is_active: true, is_verified: true })
      .eq('id', listing_id)

    if (updateError) {
      console.error('approve update error:', updateError)
      return NextResponse.json({ error: 'Failed to approve listing' }, { status: 500 })
    }

    // Email attorney — approval notification
    if (listing.email) {
      try {
        await resend.emails.send({
          from: 'MyWealthMaps <hello@mywealthmaps.com>',
          to: listing.email,
          bcc: 'avoels@comcast.net',
          subject: 'Your attorney listing has been approved — MyWealthMaps',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
              <h1 style="color:#1a1a2e;font-size:24px">MyWealthMaps</h1>
              <div style="background:#f9fafb;border-radius:8px;padding:32px;margin:24px 0">
                <p style="color:#374151;font-size:16px;line-height:1.6">Hi ${listing.contact_name ?? 'there'},</p>
                <p style="color:#374151;font-size:16px;line-height:1.6">
                  Your listing for <strong>${listing.firm_name}</strong> has been approved
                  and is now live in the MyWealthMaps attorney directory.
                </p>
                <p style="color:#374151;font-size:16px;line-height:1.6">
                  Consumers can now find your listing and request to connect with you.
                </p>
                <div style="text-align:center;margin:32px 0">
                  <a href="${process.env.NEXT_PUBLIC_SITE_URL}/login"
                    style="background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">
                    Log In to Attorney Portal
                  </a>
                </div>
              </div>
              <p style="color:#9ca3af;font-size:12px;text-align:center">Questions? Reply to this email.</p>
            </div>
          `,
        })
      } catch (e) {
        console.error('approve attorney email error:', e)
      }
    }

    // Email nominating advisor — nomination approved
    if (advisorProfile?.email) {
      try {
        await resend.emails.send({
          from: 'MyWealthMaps <hello@mywealthmaps.com>',
          to: advisorProfile.email,
          bcc: 'avoels@comcast.net',
          subject: 'The attorney you nominated is now live — MyWealthMaps',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
              <h1 style="color:#1a1a2e;font-size:24px">MyWealthMaps</h1>
              <div style="background:#f9fafb;border-radius:8px;padding:32px;margin:24px 0">
                <p style="color:#374151;font-size:16px;line-height:1.6">Hi ${advisorProfile.full_name ?? 'there'},</p>
                <p style="color:#374151;font-size:16px;line-height:1.6">
                  The attorney you nominated — <strong>${listing.firm_name}</strong> —
                  is now live in the MyWealthMaps attorney directory. Your clients can
                  find this attorney and request to connect with them.
                </p>
                <div style="text-align:center;margin:32px 0">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL}/login"
                    style="background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">
                    Sign in to MyWealthMaps
                  </a>
                  <p style="color:#6b7280;font-size:13px;margin-top:12px">
                    View the directory and your referrals from your advisor portal.
                  </p>
                </div>
              </div>
              <p style="color:#9ca3af;font-size:12px;text-align:center">Questions? Reply to this email.</p>
            </div>
          `,
        })
      } catch (e) {
        console.error('approve advisor email error:', e)
      }
    }

    if (isSuperuser) {
      await admin.from('superuser_action_log').insert({
        user_id: user.id,
        endpoint: '/api/attorney-directory/admin-action',
        target_id: listing_id,
        action: 'approve',
      })
    }
    return NextResponse.json({ success: true, action: 'approved' })
  }

  // ── 5. Reject — hard delete the listing ───────────────────
  if (action === 'reject') {
    const { error: deleteError } = await admin
      .from('attorney_listings')
      .delete()
      .eq('id', listing_id)

    if (deleteError) {
      console.error('reject delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to reject listing' }, { status: 500 })
    }

    // Email attorney — rejection notification
    if (listing.email) {
      try {
        await resend.emails.send({
          from: 'MyWealthMaps <hello@mywealthmaps.com>',
          to: listing.email,
          bcc: 'avoels@comcast.net',
          subject: 'Your attorney listing was not approved — MyWealthMaps',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
              <h1 style="color:#1a1a2e;font-size:24px">MyWealthMaps</h1>
              <div style="background:#f9fafb;border-radius:8px;padding:32px;margin:24px 0">
                <p style="color:#374151;font-size:16px;line-height:1.6">Hi ${listing.contact_name ?? 'there'},</p>
                <p style="color:#374151;font-size:16px;line-height:1.6">
                  Thank you for your interest in joining the MyWealthMaps attorney directory.
                  Unfortunately your listing for <strong>${listing.firm_name}</strong> was not
                  approved at this time.
                </p>
                <p style="color:#374151;font-size:16px;line-height:1.6">
                  If you have questions, please reply to this email.
                </p>
              </div>
              <p style="color:#9ca3af;font-size:12px;text-align:center">Questions? Reply to this email.</p>
            </div>
          `,
        })
      } catch (e) {
        console.error('reject attorney email error:', e)
      }
    }

    // Email nominating advisor — nomination rejected
    if (advisorProfile?.email) {
      try {
        await resend.emails.send({
          from: 'MyWealthMaps <hello@mywealthmaps.com>',
          to: advisorProfile.email,
          bcc: 'avoels@comcast.net',
          subject: 'Attorney nomination not approved — MyWealthMaps',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
              <h1 style="color:#1a1a2e;font-size:24px">MyWealthMaps</h1>
              <div style="background:#f9fafb;border-radius:8px;padding:32px;margin:24px 0">
                <p style="color:#374151;font-size:16px;line-height:1.6">Hi ${advisorProfile.full_name ?? 'there'},</p>
                <p style="color:#374151;font-size:16px;line-height:1.6">
                  The attorney you nominated — <strong>${listing.firm_name}</strong> —
                  was not approved for the directory at this time.
                </p>
              </div>
              <p style="color:#9ca3af;font-size:12px;text-align:center">Questions? Reply to this email.</p>
            </div>
          `,
        })
      } catch (e) {
        console.error('reject advisor email error:', e)
      }
    }

    if (isSuperuser) {
      await admin.from('superuser_action_log').insert({
        user_id: user.id,
        endpoint: '/api/attorney-directory/admin-action',
        target_id: listing_id,
        action: 'reject',
      })
    }
    return NextResponse.json({ success: true, action: 'rejected' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
