import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resend } from '@/lib/resend'
import { generateInviteToken, tokenExpiresAt } from '@/lib/invite-token'
import { AdvisorInviteEmail } from '@/emails/advisor-invite'
import * as React from 'react'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { invitedEmail } = await request.json()

    if (!invitedEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Get advisor profile
    const { data: advisor } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()

    if (!advisor || (advisor.role !== 'advisor' && advisor.role !== 'financial_advisor')) {
      return NextResponse.json({ error: 'Only advisors can send invites' }, { status: 403 })
    }

    // Check for existing pending invite
    const { data: existing } = await supabase
      .from('advisor_clients')
      .select('id, status')
      .eq('advisor_id', user.id)
      .eq('invited_email', invitedEmail)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'An invite is already pending for this email' }, { status: 409 })
    }

    // Generate token
    const token = generateInviteToken()
    const expiresAt = tokenExpiresAt()

    // Insert invite row
    const { error: insertError } = await supabase
      .from('advisor_clients')
      .insert({
        advisor_id: user.id,
        invited_email: invitedEmail,
        status: 'pending',
        invited_at: new Date().toISOString(),
        invite_token: token,
        invite_expires_at: expiresAt.toISOString()
      })

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
    }

    // Send email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const acceptUrl = `${appUrl}/invite/${token}`

    const { error: emailError } = await resend.emails.send({
      from: 'MyWealthMap <onboarding@resend.dev>',
      to: invitedEmail,
      subject: `${advisor.full_name} has invited you to MyWealthMap`,
      react: React.createElement(AdvisorInviteEmail, {
        advisorName: advisor.full_name,
        invitedEmail,
        acceptUrl
      })
    })

    if (emailError) {
      console.error('Resend error:', emailError)
      return NextResponse.json({ error: 'Invite created but email failed to send' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('Invite route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
