import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify the user is an advisor
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, email')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'advisor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { clientEmail } = await req.json()
    if (!clientEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const advisorName = profile.full_name ?? profile.email ?? 'Your financial advisor'
    const signupUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://estate-planner-gules.vercel.app'}/signup?advisor=${user.id}&email=${encodeURIComponent(clientEmail)}`

    // Check if client already has an account
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('email', clientEmail.toLowerCase())
      .single()

    if (existingProfile) {
      // Already has account — just link them
      const { error: linkError } = await supabase
        .from('advisor_clients')
        .insert({
          advisor_id: user.id,
          client_id: existingProfile.id,
          status: 'active',
          client_status: 'active',
          invited_at: new Date().toISOString(),
          accepted_at: new Date().toISOString(),
        })

      if (linkError) throw linkError

      // Send a notification email
      await resend.emails.send({
        from: 'Estate Planner <onboarding@resend.dev>',
        to: clientEmail,
        subject: `${advisorName} has connected with you on Estate Planner`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #111;">You've been connected with an advisor</h2>
            <p style="color: #555;">Hi ${existingProfile.full_name ?? 'there'},</p>
            <p style="color: #555;"><strong>${advisorName}</strong> has linked your Estate Planner account to their advisor portal. They can now view your financial projections and add notes to help guide your planning.</p>
            <a href="https://estate-planner-gules.vercel.app/dashboard" 
              style="display: inline-block; margin-top: 16px; background: #111; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              View Your Dashboard
            </a>
            <p style="margin-top: 32px; font-size: 12px; color: #999;">Estate Planner · If you didn't expect this, you can ignore this email.</p>
          </div>
        `,
      })

      return NextResponse.json({ 
        success: true, 
        message: `${existingProfile.full_name ?? clientEmail} has been linked to your account.`,
        isNew: false
      })
    }

    // No account yet — store pending invite and send signup email
    const { error: inviteError } = await supabase
      .from('advisor_clients')
      .insert({
        advisor_id: user.id,
        client_id: null,
        invited_email: clientEmail.toLowerCase(),
        status: 'active',
        client_status: 'inactive',
        invited_at: new Date().toISOString(),
        accepted_at: null,
      })

    if (inviteError) throw inviteError

    // Send invitation email
    await resend.emails.send({
      from: 'Estate Planner <onboarding@resend.dev>',
      to: clientEmail,
      subject: `${advisorName} invited you to Estate Planner`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #111;">You've been invited to Estate Planner</h2>
          <p style="color: #555;">Hi there,</p>
          <p style="color: #555;"><strong>${advisorName}</strong> has invited you to join Estate Planner — a retirement and estate planning tool that helps you visualize your financial future.</p>
          <p style="color: #555;">Create your free account to get started. Your advisor will be able to view your projections and help guide your planning.</p>
          <a href="${signupUrl}" 
            style="display: inline-block; margin-top: 16px; background: #111; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Create Your Free Account
          </a>
          <p style="margin-top: 32px; font-size: 12px; color: #999;">Estate Planner · If you didn't expect this, you can ignore this email.</p>
        </div>
      `,
    })

    return NextResponse.json({ 
      success: true, 
      message: `Invitation sent to ${clientEmail}. They'll be linked to your account once they sign up.`,
      isNew: true
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    console.error('Invite error:', message)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
