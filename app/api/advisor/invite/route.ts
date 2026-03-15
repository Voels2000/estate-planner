import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
      // Check if already linked
      const { data: existing } = await supabase
        .from('advisor_clients')
        .select('id')
        .eq('advisor_id', user.id)
        .eq('client_id', existingProfile.id)
        .single()

      if (existing) {
        return NextResponse.json({ error: 'This client is already linked to your account.' }, { status: 400 })
      }

      // Link existing client
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

      return NextResponse.json({
        success: true,
        message: `${existingProfile.full_name ?? clientEmail} has been linked to your account.`,
        isNew: false
      })
    }

    // No account yet — store pending invite
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

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${clientEmail}. They will be linked once they sign up.`,
      isNew: true
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    console.error('Invite error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
