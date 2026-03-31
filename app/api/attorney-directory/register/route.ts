import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resend } from '@/lib/resend'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as {
    firm_name?: string
    contact_name?: string
    email?: string
    phone?: string
    city?: string
    state?: string
    bar_number?: string
    fee_structure?: string
    bio?: string
    website?: string
    serves_remote?: boolean
    specializations?: string[]
    states_licensed?: string[]
    languages?: string[]
  }

  if (!body.firm_name || !body.email || !body.state) {
    return NextResponse.json(
      { error: 'Firm name, email, and state are required.' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('attorney_listings')
    .insert({
      firm_name: body.firm_name,
      contact_name: body.contact_name ?? null,
      email: body.email,
      phone: body.phone ?? null,
      city: body.city ?? null,
      state: body.state,
      bar_number: body.bar_number ?? null,
      fee_structure: body.fee_structure ?? null,
      bio: body.bio ?? null,
      website: body.website ?? null,
      serves_remote: body.serves_remote ?? false,
      specializations: body.specializations ?? [],
      states_licensed: body.states_licensed ?? [],
      languages: body.languages ?? [],
      is_active: false,
      is_verified: false,
      submitted_by: user.id,
    })

  if (error) {
    console.error('attorney register:', error)
    return NextResponse.json({ error: 'Failed to submit listing.' }, { status: 500 })
  }

  // Notify admin of new attorney listing pending review
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    await resend.emails.send({
      from: 'MyWealthMaps <hello@mywealthmaps.com>',
      to: 'avoels@comcast.net',
      subject: 'New Attorney Listing Submitted — Pending Review',
      headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
      tags: [{ name: 'category', value: 'admin_attorney_listing' }],
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
          <h1 style="color:#1a1a2e;font-size:24px">MyWealthMaps</h1>
          <p style="color:#6b7280;font-size:14px">Admin Notification</p>
          <div style="background:#f9fafb;border-radius:8px;padding:32px;margin:24px 0">
            <h2 style="color:#1a1a2e;font-size:20px;margin-top:0">New Attorney Listing Pending Review</h2>
            <p style="color:#374151;font-size:16px;line-height:1.6">
              A new attorney listing has been submitted and is awaiting your approval.
            </p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr>
                <td style="padding:8px 0;color:#6b7280;font-size:14px;width:140px">Firm</td>
                <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600">${body.firm_name}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#6b7280;font-size:14px">Contact</td>
                <td style="padding:8px 0;color:#111827;font-size:14px">${body.contact_name ?? '—'}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#111827;font-size:14px">Email</td>
                <td style="padding:8px 0;color:#111827;font-size:14px">${body.email}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#6b7280;font-size:14px">Location</td>
                <td style="padding:8px 0;color:#111827;font-size:14px">${[body.city, body.state].filter(Boolean).join(', ') || '—'}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#6b7280;font-size:14px">Bar Number</td>
                <td style="padding:8px 0;color:#111827;font-size:14px">${body.bar_number ?? '—'}</td>
              </tr>
            </table>
            <div style="text-align:center;margin:32px 0">
              <a href="${appUrl}/admin/attorney-directory"
                 style="background:#1a1a2e;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">
                Review Listing →
              </a>
            </div>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center">
            This is an automated notification from MyWealthMaps.
          </p>
        </div>
      `,
    })
  } catch (emailErr) {
    // Non-fatal — listing saved successfully, email failure should not block response
    console.error('Admin attorney notification email failed:', emailErr)
  }

  return NextResponse.json({ success: true })
}
