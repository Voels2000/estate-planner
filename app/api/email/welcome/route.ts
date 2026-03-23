import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resend } from '@/lib/resend'


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
      from: 'MyWealthMap <noreply@my-wealth-map.com>'
,
      to: user.email,
      subject: 'Welcome to MyWealthMap',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
          <h1 style="color:#1a1a2e;font-size:24px">MyWealthMap</h1>
          <p style="color:#6b7280;font-size:14px">Financial, Retirement &amp; Estate Planning in One Place</p>
          <div style="background:#f9fafb;border-radius:8px;padding:32px;margin:24px 0">
            <h2 style="color:#1a1a2e;font-size:20px;margin-top:0">Welcome, ${firstName}!</h2>
            <p style="color:#374151;font-size:16px;line-height:1.6">Your MyWealthMap account is ready. You now have access to a complete suite of financial planning tools.</p>
            <div style="text-align:center;margin:32px 0">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">Go to My Dashboard</a>
            </div>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center">Questions? Reply to this email and we will get back to you.</p>
        </div>
      `
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
