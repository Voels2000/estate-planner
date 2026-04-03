import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { resend } from '@/lib/resend'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { isAdmin, isSuperuser, user } = await getAccessContext()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { listing_id, action } = await req.json()
    if (!listing_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'listing_id and action (approve|reject) are required' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: listing, error: fetchError } = await admin
      .from('advisor_directory')
      .select('id, firm_name, email, contact_name')
      .eq('id', listing_id)
      .single()

    if (fetchError || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (action === 'approve') {
      const { error: updateError } = await admin
        .from('advisor_directory')
        .update({ is_active: true, is_verified: true })
        .eq('id', listing_id)

      if (updateError) throw updateError

      // Email advisor — approval notification
      if (listing.email) {
        try {
          await resend.emails.send({
            from: 'MyWealthMaps <hello@mywealthmaps.com>',
            to: listing.email,
            bcc: 'avoels@comcast.net',
            subject: 'Your advisor listing is now live — MyWealthMaps',
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
                <h1 style="color:#1a1a2e;font-size:24px">MyWealthMaps</h1>
                <div style="background:#f9fafb;border-radius:8px;padding:32px;margin:24px 0">
                  <p style="color:#374151;font-size:16px;line-height:1.6">Hi ${listing.contact_name ?? 'there'},</p>
                  <p style="color:#374151;font-size:16px;line-height:1.6">
                    Your listing for <strong>${listing.firm_name}</strong> is now live
                    in the MyWealthMaps advisor directory. Consumers can find your listing
                    and request to connect with you.
                  </p>
                  <div style="text-align:center;margin:32px 0">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL}/login"
                      style="background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">
                      Sign in to MyWealthMaps
                    </a>
                    <p style="color:#6b7280;font-size:13px;margin-top:12px">
                      View the directory and manage your referrals from your advisor portal.
                    </p>
                  </div>
                </div>
                <p style="color:#9ca3af;font-size:12px;text-align:center">Questions? Reply to this email.</p>
              </div>
            `,
          })
        } catch (emailError) {
          console.error('admin-action approve email error:', emailError)
        }
      }

      if (isSuperuser) {
        await admin.from('superuser_action_log').insert({
          user_id: user.id,
          endpoint: '/api/advisor-directory/admin-action',
          target_id: listing_id,
          action: 'approve',
        })
      }
      return NextResponse.json({ success: true, action: 'approved' })
    }

    if (action === 'reject') {
      // Email advisor before deleting
      if (listing.email) {
        try {
          await resend.emails.send({
            from: 'MyWealthMaps <hello@mywealthmaps.com>',
            to: listing.email,
            bcc: 'avoels@comcast.net',
            subject: 'Your advisor listing was not approved — MyWealthMaps',
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
                <h1 style="color:#1a1a2e;font-size:24px">MyWealthMaps</h1>
                <div style="background:#f9fafb;border-radius:8px;padding:32px;margin:24px 0">
                  <p style="color:#374151;font-size:16px;line-height:1.6">Hi ${listing.contact_name ?? 'there'},</p>
                  <p style="color:#374151;font-size:16px;line-height:1.6">
                    Thank you for your interest in joining the MyWealthMaps advisor directory.
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
        } catch (emailError) {
          console.error('admin-action reject email error:', emailError)
        }
      }

      const { error: deleteError } = await admin
        .from('advisor_directory')
        .delete()
        .eq('id', listing_id)

      if (deleteError) throw deleteError

      if (isSuperuser) {
        await admin.from('superuser_action_log').insert({
          user_id: user.id,
          endpoint: '/api/advisor-directory/admin-action',
          target_id: listing_id,
          action: 'reject',
        })
      }
      return NextResponse.json({ success: true, action: 'rejected' })
    }

  } catch (error) {
    console.error('advisor admin-action error:', error)
    return NextResponse.json({ error: 'Action failed' }, { status: 500 })
  }
}
