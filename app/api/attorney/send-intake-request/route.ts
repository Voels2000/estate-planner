import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppUrl } from '@/lib/app-url'
import { buildIntakeRequestEmail } from '@/lib/email/buildIntakeRequestEmail'
import { resend } from '@/lib/resend'

function isAttorneyProfile(profile: { role?: string | null; is_attorney?: boolean | null }) {
  return profile.role === 'attorney' || profile.is_attorney === true
}

function isProfessionalProfile(profile: {
  role?: string | null
  is_attorney?: boolean | null
}) {
  return isAttorneyProfile(profile) || profile.role === 'advisor'
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, attorney_tier, is_attorney')
      .eq('id', user.id)
      .single()

    if (!isProfessionalProfile(profile ?? {})) {
      return NextResponse.json({ error: 'Professional role required' }, { status: 403 })
    }

    if (isAttorneyProfile(profile ?? {}) && (profile?.attorney_tier ?? 0) === 0) {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { count } = await supabase
        .from('attorney_intake_requests')
        .select('*', { count: 'exact', head: true })
        .eq('attorney_id', user.id)
        .gte('created_at', startOfMonth.toISOString())

      if ((count ?? 0) >= 5) {
        return NextResponse.json(
          { error: 'Free plan limited to 5 intake requests per month. Upgrade to send more.' },
          { status: 403 },
        )
      }
    }

    const { clientEmail, clientName, message } = (await req.json()) as {
      clientEmail?: string
      clientName?: string
      message?: string
    }

    if (!clientEmail || !clientEmail.includes('@')) {
      return NextResponse.json({ error: 'Valid client email required' }, { status: 400 })
    }

    const { data: listing } = await supabase
      .from('attorney_listings')
      .select('id, firm_name')
      .eq('profile_id', user.id)
      .maybeSingle()

    const { data: intakeRequest, error: insertError } = await adminSupabase
      .from('attorney_intake_requests')
      .insert({
        attorney_id: user.id,
        listing_id: listing?.id ?? null,
        client_email: clientEmail.trim().toLowerCase(),
        client_name: clientName?.trim() ?? null,
        message: message?.trim() ?? null,
      })
      .select('id, token')
      .single()

    if (insertError || !intakeRequest) {
      console.error('Intake request insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create intake request' }, { status: 500 })
    }

    const baseUrl = getAppUrl()
    const acceptUrl = `${baseUrl}/intake/${intakeRequest.token}`
    const attorneyName =
      profile?.full_name ??
      listing?.firm_name ??
      (profile?.role === 'advisor' ? 'Your advisor' : 'Your attorney')

    const { error: emailError } = await resend.emails.send({
      from: 'My Wealth Maps <hello@mywealthmaps.com>',
      to: clientEmail.trim().toLowerCase(),
      bcc: 'avoels@comcast.net',
      subject: `${attorneyName} has invited you to complete your estate planning profile`,
      html: buildIntakeRequestEmail({
        attorneyName,
        clientName: clientName?.trim() || 'there',
        personalMessage: message?.trim() ?? null,
        acceptUrl,
        expiresInDays: 14,
      }),
    })

    if (emailError) {
      console.error('Intake request email error:', emailError)
      return NextResponse.json({
        success: true,
        warning: 'Request created but email delivery failed',
        requestId: intakeRequest.id,
      })
    }

    return NextResponse.json({ success: true, requestId: intakeRequest.id })
  } catch (err) {
    console.error('Send intake request error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
