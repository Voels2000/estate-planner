import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resend } from '@/lib/resend'
import { WelcomeEmail } from '@/emails/welcome'
import * as React from 'react'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const fullName = profile?.full_name ?? ''
    const firstName = fullName.split(' ')[0] || 'there'

    const { error: emailError } = await resend.emails.send({
      from: 'MyWealthMap <onboarding@resend.dev>',
      to: user.email,
      subject: 'Welcome to MyWealthMap',
      react: React.createElement(WelcomeEmail, { firstName })
    })

    if (emailError) {
      console.error('Welcome email error:', emailError)
      return NextResponse.json({ error: 'Failed to send welcome email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('Welcome route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
